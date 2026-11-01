import {
	emptySyncDocument,
	syncDeleteResponseSchema,
	syncStateSchema,
} from '@unbound-app/contracts/sync';
import type { SyncDocument } from '@unbound-app/contracts/sync';
import { ApiRequestError } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

import { applyActions, collectLocalDocument } from '~/sync/device';
import { isJsonEqual, plan, reconcileBase } from '~/sync/merge';
import type { Account } from '~/account/account';
import type { SyncStrategy } from '~/sync/merge';
import type { ApiRequest } from '~/account/api';
import { getBucket } from '~/storage/api';
import * as account from '~/account/api';

/** The settings store Sync keeps its mode and last agreed document in. Never synced. */
export const SYNC_STORE = 'unbound::sync';

/** @deprecated Use account.Account */
export type SyncAccount = Account;

/** Which way automatic syncs move changes on this device. */
export type SyncMode = 'two-way' | 'download' | 'upload';

const MODE_STRATEGIES: Record<SyncMode, SyncStrategy> = {
	'two-way': 'merge',
	download: 'pull',
	upload: 'push',
};

const logger = createLogger('Sync');
const Store = getBucket(SYNC_STORE);

let running: Promise<boolean> | undefined;
let rerun = false;
let applying = false;

/**
 * @deprecated Use account.getAccount
 * @returns The signed-in account, or `null`.
 */
export function getSession(): Account | null {
	return account.getAccount() ?? null;
}

/** @returns Whether this device syncs automatically. */
export function isEnabled(): boolean {
	return Boolean(account.getAccount()) && Store.get('enabled', false) && !needsFirstSyncChoice();
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

/**
 * @returns Whether a sync is applying remote changes right now, so the changes it makes can be told apart.
 */
export function isApplying(): boolean {
	return applying;
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
	if (!account.getAccount()) {
		return false;
	}

	const request = account.createClient();

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

		return false;
	}
}

/**
 * @description Syncs now: reads the stored document, merges, applies remote changes here and saves
 * the result. A call while a sync runs queues one more run after it, in this device's mode.
 * @param strategy How to reconcile the two sides; this device's mode by default.
 * @returns Whether the sync succeeded. Failures are recorded as `lastError` in {@link SYNC_STORE}.
 */
export function now(strategy: SyncStrategy = MODE_STRATEGIES[getMode()]): Promise<boolean> {
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
 * @description Starts syncing for an account that just signed in: turns syncing on, and asks how to
 * combine this device with a setup the cloud already holds before the first sync.
 * @returns Whether the cloud could be read. Failures are recorded as `lastError`.
 */
export async function connect(): Promise<boolean> {
	try {
		const remote = await account.createClient()('GET /api/v1/sync', {
			response: syncStateSchema,
		});

		resetBase();
		Store.set('enabled', true);
		Store.set('lastError', null);
		Store.set('pendingChoice', remote.revision > 0);

		if (remote.revision === 0) {
			void now('push');
		}

		return true;
	} catch (error) {
		logger.error('Failed to read the cloud setup after signing in:', error);
		Store.set('lastError', toError(error).message);

		return false;
	}
}

/**
 * @description Stops syncing after the account signed out and forgets what was agreed with its
 * cloud setup. Installed addons and settings stay as they are.
 */
export function disconnect() {
	Store.set('pendingChoice', false);
	Store.set('enabled', false);
	Store.set('lastSyncedAt', null);
	Store.set('lastError', null);
	resetBase();
}

/**
 * @deprecated Use account.signIn
 * @returns Whether the account signed in.
 */
export async function signIn(): Promise<boolean> {
	return (await account.signIn()).status === 'signed-in';
}

/**
 * @deprecated Use account.signOut
 * @returns Once the account signed out.
 */
export function signOut(): Promise<void> {
	return account.signOut();
}

/**
 * @description Turns automatic syncing on or off, syncing right away when turned on.
 * @param enabled Whether to sync automatically.
 */
export function setEnabled(enabled: boolean) {
	Store.set('enabled', enabled);

	if (isEnabled()) {
		void now();
	}
}

/**
 * @description Sets which way automatic syncs move changes, syncing right away when sync is on.
 * @param mode The new mode.
 */
export function setMode(mode: SyncMode) {
	Store.set('mode', mode);

	if (isEnabled()) {
		void now();
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

	return now(strategy);
}

/**
 * @description Deletes the stored document and turns syncing off on this device, so it is not
 * uploaded again. Other devices keep what they have installed.
 * @returns Whether the document was deleted. Failures are recorded as `lastError`.
 */
export async function deleteData(): Promise<boolean> {
	try {
		await account.createClient()('DELETE /api/v1/sync', { response: syncDeleteResponseSchema });

		Store.set('enabled', false);
		Store.set('lastSyncedAt', null);
		Store.set('lastError', null);
		resetBase();

		return true;
	} catch (error) {
		logger.error('Failed to delete the Sync data:', error);
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
	now,
	signIn,
	signOut,
	connect,
	disconnect,
	setEnabled,
	deleteData,
};
