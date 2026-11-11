import { emptySyncDocument } from '@unbound-app/contracts/sync-buckets';
import type { SyncDocument } from '@unbound-app/contracts/sync';
import { ApiRequestError } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

import { applyActions, collectLocalDocument } from '~/sync/device';
import { isJsonEqual, plan, reconcileBase } from '~/sync/merge';
import type { ApiRequest } from '~/account/client';
import type { SyncStrategy } from '~/sync/merge';
import { getBucket } from '~/storage/api';
import * as account from '~/account/api';

/** The Bucket Sync keeps its mode and last agreed document in. Never synced. */
export const SYNC_STORE = 'unbound::sync';

/** Which way automatic syncs move changes on this device. */
export type SyncMode = 'two-way' | 'download' | 'upload';

const MODE_STRATEGIES: Record<SyncMode, SyncStrategy> = {
	'two-way': 'merge',
	download: 'pull',
	upload: 'push',
};

const logger = createLogger('Sync');
const bucket = getBucket(SYNC_STORE);

let running: Promise<boolean> | undefined;
let rerun = false;
let applying = false;

/** @returns Whether this device syncs automatically. */
export function isEnabled(): boolean {
	return Boolean(account.getAccount()) && bucket.get('enabled', false) && !needsFirstSyncChoice();
}

/** @returns Which way automatic syncs move changes on this device. */
export function getMode(): SyncMode {
	const mode = bucket.get('mode', 'two-way');

	return isSyncMode(mode) ? mode : 'two-way';
}

function isSyncMode(value: string): value is SyncMode {
	return Object.hasOwn(MODE_STRATEGIES, value);
}

/** @returns Whether the cloud already held a setup at sign-in and the user has not chosen how to combine it with this device. */
function needsFirstSyncChoice(): boolean {
	return bucket.get('pendingChoice', false);
}

/**
 * @returns Whether a sync is applying remote changes right now, so the changes it makes can be told apart.
 */
export function isApplying(): boolean {
	return applying;
}

function resetBase() {
	bucket.set('base', null);
	bucket.set('revision', 0);
}

function readBase(remoteRevision: number): SyncDocument {
	const revision = bucket.get('revision', 0);
	const base = bucket.get<SyncDocument | null>('base', null);

	// A remote revision behind ours means the document was deleted since, so nothing is agreed on.
	if (!base || remoteRevision === 0 || remoteRevision < revision) {
		return emptySyncDocument();
	}

	return base;
}

async function attempt(request: ApiRequest, strategy: SyncStrategy) {
	const remote = await request('GET /api/v1/sync');
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
				});

	bucket.set('base', reconcileBase(saved.document, base, failed));
	bucket.set('revision', saved.revision);
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

		bucket.set('lastSyncedAt', new Date().toISOString());
		bucket.set('lastError', null);

		return true;
	} catch (error) {
		logger.error('Failed to sync:', error);
		bucket.set('lastError', toError(error).message);

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
 * @description Turns syncing on. A cloud setup this device has never agreed with waits for the user to
 * choose how to combine them; otherwise it syncs right away, uploading when the cloud is empty.
 * @returns Whether the cloud could be read. Failures are recorded as `lastError`.
 */
async function begin(): Promise<boolean> {
	try {
		const remote = await account.createClient()('GET /api/v1/sync', {});
		const revision = bucket.get('revision', 0);
		// A remote revision behind ours means the document was deleted since, so nothing is agreed on.
		const agreed = revision > 0 && remote.revision >= revision;

		bucket.set('enabled', true);
		bucket.set('lastError', null);
		bucket.set('pendingChoice', remote.revision > 0 && !agreed);

		if (remote.revision === 0) {
			return await now('push');
		}

		return agreed ? await now() : true;
	} catch (error) {
		logger.error('Failed to read the cloud setup:', error);
		bucket.set('lastError', toError(error).message);

		return false;
	}
}

/**
 * @description Starts syncing for an account that just signed in: forgets what was agreed before, turns
 * syncing on, and asks how to combine this device with a setup the cloud already holds.
 * @returns Whether the cloud could be read. Failures are recorded as `lastError`.
 * @internal
 */
export function connect(): Promise<boolean> {
	resetBase();

	return begin();
}

/**
 * @description Stops syncing after the account signed out and forgets what was agreed with its
 * cloud setup. Installed addons and settings stay as they are.
 * @internal
 */
export function disconnect() {
	bucket.set('pendingChoice', false);
	bucket.set('enabled', false);
	bucket.set('lastSyncedAt', null);
	bucket.set('lastError', null);
	resetBase();
}

/**
 * @description Turns automatic syncing on or off. Turning it on syncs right away, or first asks how to
 * combine this device with a cloud setup it has never synced with.
 * @param enabled Whether to sync automatically.
 * @returns Whether turning it on could read the cloud; always true when turning it off.
 */
export function setEnabled(enabled: boolean): Promise<boolean> {
	if (!enabled) {
		// Turning it off also dismisses a first-sync choice; turning it on again asks again.
		bucket.set('pendingChoice', false);
		bucket.set('enabled', false);

		return Promise.resolve(true);
	}

	return begin();
}

/**
 * @description Sets which way automatic syncs move changes, syncing right away when sync is on.
 * @param mode The new mode.
 */
export function setMode(mode: SyncMode) {
	bucket.set('mode', mode);

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
	bucket.set('pendingChoice', false);

	return now(strategy);
}

/**
 * @description Deletes the stored document and turns syncing off on this device, so it is not
 * uploaded again. Other devices keep what they have installed.
 * @returns Whether the document was deleted. Failures are recorded as `lastError`.
 */
export async function deleteData(): Promise<boolean> {
	try {
		await account.createClient()('DELETE /api/v1/sync');

		bucket.set('enabled', false);
		bucket.set('lastSyncedAt', null);
		bucket.set('lastError', null);
		resetBase();

		return true;
	} catch (error) {
		logger.error('Failed to delete the Sync data:', error);
		bucket.set('lastError', toError(error).message);

		return false;
	}
}
