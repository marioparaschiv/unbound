import {
	emptySyncDocument,
	syncDeleteResponseSchema,
	syncOAuthConfigSchema,
	syncSignInResponseSchema,
	syncStateSchema,
} from '@unbound-app/contracts/sync';
import { ApiRequestError, createApiClient } from '@unbound-app/web/client';
import type { SyncDocument } from '@unbound-app/contracts/sync';
import type { Caller } from '@unbound-app/contracts/account';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import type { Api } from '@unbound-app/web/api';

import { applyActions, collectLocalDocument } from '~/managers/sync-device';
import { isJsonEqual, plan, reconcileBase } from '~/lib/sync';
import { authorizeWithDiscord } from '~/lib/discord-oauth';
import type { SyncStrategy } from '~/lib/sync';
import { API_URL } from '~/lib/constants';
import { getStore } from '~/api/storage';

/** The settings store Cloud Sync keeps its session and last agreed document in. Never synced. */
export const SYNC_STORE = 'unbound::sync';

/** A signed-in Cloud Sync account. */
export type SyncSession = {
	token: string;
	user: Caller;
};

/** Which way automatic syncs move changes on this device. */
export type SyncMode = 'two-way' | 'download' | 'upload';

const MODE_STRATEGIES: Record<SyncMode, SyncStrategy> = {
	'two-way': 'merge',
	download: 'pull',
	upload: 'push',
};

type ApiRequest = ReturnType<typeof createApiClient<Api>>;

const logger = createLogger('Cloud Sync');
const Store = getStore(SYNC_STORE);

let running: Promise<boolean> | undefined;
let rerun = false;
let applying = false;

/** @returns The signed-in account, or `null`. */
export function getSession(): SyncSession | null {
	return Store.get<SyncSession | null>('session', null);
}

/** @returns Whether this device syncs automatically. */
export function isEnabled(): boolean {
	return Boolean(getSession()) && Store.get('enabled', false) && !needsFirstSyncChoice();
}

/** @returns Which way automatic syncs move changes on this device. */
export function getMode(): SyncMode {
	const mode = Store.get('mode', 'two-way');

	return isSyncMode(mode) ? mode : 'two-way';
}

function isSyncMode(value: string): value is SyncMode {
	return Object.hasOwn(MODE_STRATEGIES, value);
}

/** @returns Whether the cloud already held a setup at sign-in and the user has not chosen how to combine it with this device. */
function needsFirstSyncChoice(): boolean {
	return Store.get('pendingChoice', false);
}

/** @returns Whether a sync is applying remote changes right now, so the changes it makes can be told apart. */
export function isApplying(): boolean {
	return applying;
}

function client(session: SyncSession | null = getSession()): ApiRequest {
	const headers = session ? { authorization: `Bearer ${session.token}` } : undefined;

	return createApiClient<Api>({ baseUrl: API_URL, headers });
}

function resetBase() {
	Store.set('base', null);
	Store.set('revision', 0);
}

function readBase(remoteRevision: number): SyncDocument {
	const revision = Store.get('revision', 0);
	const base = Store.get<SyncDocument | null>('base', null);

	// A remote revision behind ours means the document was deleted since, so nothing is agreed on.
	if (!base || remoteRevision === 0 || remoteRevision < revision) {
		return emptySyncDocument();
	}

	return base;
}

async function attempt(request: ApiRequest, strategy: SyncStrategy) {
	const remote = await request('GET /api/v1/sync', { response: syncStateSchema });
	const base = readBase(remote.revision);
	const { document, actions } = plan(strategy, base, collectLocalDocument(), remote.document);

	applying = true;

	const failed = await applyActions(actions).finally(() => {
		applying = false;
	});

	// A download never writes back, so a failed install here cannot remove it from the cloud.
	const saved =
		strategy === 'pull' || isJsonEqual(document, remote.document)
			? remote
			: await request('PUT /api/v1/sync', {
					body: { revision: remote.revision, document },
					response: syncStateSchema,
				});

	Store.set('base', reconcileBase(saved.document, base, failed));
	Store.set('revision', saved.revision);
}

function isConflict(error: Error): boolean {
	return error instanceof ApiRequestError && error.code === 'sync_conflict';
}

async function run(strategy: SyncStrategy): Promise<boolean> {
	const session = getSession();

	if (!session) {
		return false;
	}

	const request = client(session);

	try {
		await attempt(request, strategy).catch((error) => {
			// Another device saved between our read and write: merge again against its document.
			if (isConflict(toError(error))) {
				return attempt(request, strategy);
			}

			throw error;
		});

		Store.set('lastSyncedAt', new Date().toISOString());
		Store.set('lastError', null);

		return true;
	} catch (error) {
		logger.error('Failed to sync:', error);
		Store.set('lastError', toError(error).message);

		if (error instanceof ApiRequestError && error.status === 401) {
			Store.set('session', null);
		}

		return false;
	}
}

/**
 * @description Syncs now: reads the stored document, merges, applies remote changes here and saves
 * the result. A call while a sync runs queues one more run after it, in this device's mode.
 * @param strategy How to reconcile the two sides; this device's mode by default.
 * @returns Whether the sync succeeded. Failures are recorded as `lastError` in {@link SYNC_STORE}.
 */
export function sync(strategy: SyncStrategy = MODE_STRATEGIES[getMode()]): Promise<boolean> {
	if (running) {
		rerun = true;

		return running;
	}

	running = (async () => {
		let ok = false;

		let next = strategy;

		do {
			rerun = false;
			ok = await run(next);
			next = MODE_STRATEGIES[getMode()];
		} while (rerun);

		return ok;
	})().finally(() => {
		running = undefined;
	});

	return running;
}

/**
 * @description Signs in through Discord's in-app authorize screen, turns syncing on and syncs.
 * @returns Whether the user signed in. Failures are recorded as `lastError`.
 */
export async function signIn(): Promise<boolean> {
	try {
		const request = client(null);
		const config = await request('GET /api/v1/sync/oauth', { response: syncOAuthConfigSchema });
		const code = await authorizeWithDiscord(config);

		if (!code) {
			return false;
		}

		const session = await request('POST /api/v1/sync/oauth', {
			body: { code },
			response: syncSignInResponseSchema,
		});

		const remote = await client(session)('GET /api/v1/sync', { response: syncStateSchema });

		resetBase();
		Store.set('session', session);
		Store.set('enabled', true);
		Store.set('lastError', null);
		Store.set('pendingChoice', remote.revision > 0);

		if (remote.revision === 0) {
			void sync('push');
		}

		return true;
	} catch (error) {
		logger.error('Failed to sign in:', error);
		Store.set('lastError', toError(error).message);

		return false;
	}
}

/** @description Signs out on this device. Installed addons and settings stay as they are. */
export function signOut() {
	Store.set('session', null);
	Store.set('pendingChoice', false);
	Store.set('enabled', false);
	Store.set('lastSyncedAt', null);
	Store.set('lastError', null);
	resetBase();
}

/**
 * @description Turns automatic syncing on or off, syncing right away when turned on.
 * @param enabled Whether to sync automatically.
 */
export function setEnabled(enabled: boolean) {
	Store.set('enabled', enabled);

	if (isEnabled()) {
		void sync();
	}
}

/**
 * @description Sets which way automatic syncs move changes, syncing right away when sync is on.
 * @param mode The new mode.
 */
export function setMode(mode: SyncMode) {
	Store.set('mode', mode);

	if (isEnabled()) {
		void sync();
	}
}

/**
 * @description Settles how this device and an existing cloud setup combine on the first sync after
 * signing in, then turns automatic syncing on.
 * @param strategy `merge` keeps both, `pull` replaces this device's setup, `push` replaces the cloud's.
 * @returns Whether the sync succeeded.
 */
export function resolveFirstSync(strategy: SyncStrategy): Promise<boolean> {
	Store.set('pendingChoice', false);

	return sync(strategy);
}

/**
 * @description Deletes the stored document and turns syncing off on this device, so it is not
 * uploaded again. Other devices keep what they have installed.
 * @returns Whether the document was deleted. Failures are recorded as `lastError`.
 */
export async function deleteCloudData(): Promise<boolean> {
	try {
		await client()('DELETE /api/v1/sync', { response: syncDeleteResponseSchema });

		Store.set('enabled', false);
		Store.set('lastSyncedAt', null);
		Store.set('lastError', null);
		resetBase();

		return true;
	} catch (error) {
		logger.error('Failed to delete the Cloud Sync data:', error);
		Store.set('lastError', toError(error).message);

		return false;
	}
}

export default {
	SYNC_STORE,
	getSession,
	isEnabled,
	isApplying,
	getMode,
	needsFirstSyncChoice,
	setMode,
	resolveFirstSync,
	sync,
	signIn,
	signOut,
	setEnabled,
	deleteCloudData,
};
