import Logger from '@unbound-app/logger';

import { broadcast, bundleEtag } from './hot-reload';

/** How the device took the latest source change. */
export type Outcome = {
	result: 'patched' | 'reloaded' | 'failed' | 'unchanged';
	files: string[];
	detail: string;
};

const logger = Logger.create('Serve', 'Outcome');

// The watcher sees a save within tens of milliseconds, so a request made right after saving still finds it pending.
const SETTLE_MS = 300;
const WAIT_MS = 60_000;

const files = new Set<string>();
const waiters = new Set<() => void>();

// A change is covered once the client refreshes the patch for the latest `generation`; otherwise the loader reloads.
let generation = 0;
let sentGeneration = -1;
let builtGeneration = 0;
let reloadReason: string | undefined;
let reloadSent = false;
let sentEtag = '';
let reconnectedSinceSent = false;
let last: Outcome | undefined;

/**
 * @description Records a source file the watcher saw change, opening an outcome for it.
 * @param file The file, relative to the client package.
 */
export function changed(file: string) {
	files.add(file);
	generation++;
	// A change during a reload makes the reloading bundle stale, so its build is broadcast again.
	reloadSent = false;
}

/** @description Records that a patch for the latest change went to the client. */
export function sent() {
	sentGeneration = generation;
}

/**
 * @description Marks the open change as needing a reload, which the loader runs once its build is on disk.
 * @param reason Why no patch covered the change.
 */
export function needsReload(reason: string) {
	reloadReason ??= reason;
	broadcastWhenBuilt();
}

/**
 * @description Whether a change no patch covered still waits for the loader to reload.
 * @returns `true` while a reload is owed, so a reconnecting loader is sent the current etag.
 */
export function reloadPending(): boolean {
	return reloadReason !== undefined;
}

/** @description Settles a reload once a fresh bundle opens its socket, unless a newer change is still building. */
export function reconnected() {
	reconnectedSinceSent = true;

	if (reloadSent && reloadReason !== undefined && builtGeneration === generation) {
		settle('reloaded', reloadReason);
	}
}

/**
 * @description Settles the open change as patched in place when the patch was for the latest change.
 * @param fibers How many mounted fibers re-rendered or remounted.
 * @param remounted How many of them remounted, losing their state, because their hooks could not be spliced.
 * @param ms How long the device took to apply it.
 */
export function patched(fibers: number, remounted: number, ms: number) {
	if (sentGeneration !== generation || reloadReason !== undefined) return;

	const hint =
		fibers === 0 ? '; no mounted component re-rendered, open the screen that shows it' : '';

	settle('patched', `${fibers} fibers (${remounted} remounted) in ${ms}ms${hint}`);
}

/**
 * @description Settles the open change as failed. A broken change fails both the hot update and the rebuild; the first wins.
 * @param error What failed: the build, or the hot update.
 */
export function failed(error: string) {
	if (pending()) {
		settle('failed', error);
	}
}

/** @description Records that the latest change's build is on disk; a change no client took a patch for reloads. */
export function built() {
	builtGeneration = generation;

	if (files.size && sentGeneration !== generation) {
		reloadReason ??= 'no connected client took a patch';
	}

	broadcastWhenBuilt();
}

// The loader fetches the bundle on disk, so a reload waits for the build of the latest change.
function broadcastWhenBuilt() {
	if (reloadReason === undefined || reloadSent || builtGeneration !== generation) return;

	const etag = bundleEtag();

	// A rewrite that built the same bundle, such as a formatter pass, is already loaded; the loader would skip it.
	if (etag === sentEtag && reconnectedSinceSent) {
		settle('reloaded', reloadReason);

		return;
	}

	reloadSent = true;
	sentEtag = etag;
	reconnectedSinceSent = false;

	if (!broadcast()) {
		settle('unchanged', `built, but no loader is connected to reload (${reloadReason})`);
	}
}

function settle(result: Outcome['result'], detail: string) {
	last = { result, files: [...files], detail };
	files.clear();
	reloadReason = undefined;
	reloadSent = false;

	logger.info(`Hot update ${result}: ${last.files.join(', ') || 'no file'}: ${detail}`);

	for (const wake of waiters) wake();
}

function pending() {
	return files.size > 0;
}

function waitForSettle(): Promise<boolean> {
	return new Promise((resolve) => {
		function wake() {
			clearTimeout(timer);
			waiters.delete(wake);
			resolve(true);
		}

		const timer = setTimeout(() => {
			waiters.delete(wake);
			resolve(false);
		}, WAIT_MS);

		waiters.add(wake);
	});
}

/**
 * @description Answers `GET /__outcome`: waits for the change in flight to settle, then reports how the device took it.
 * @returns `<result>: <files>: <detail>`, 504 when a change is still pending, 404 before any change.
 */
export async function handleOutcome(): Promise<Response> {
	await Bun.sleep(SETTLE_MS);

	if (pending() && !(await waitForSettle())) {
		const state = reloadSent
			? 'the loader reloaded, but the client did not reconnect'
			: 'no outcome';

		return new Response(`pending: ${[...files].join(', ')}: ${state} within ${WAIT_MS}ms\n`, {
			status: 504,
		});
	}

	if (!last) {
		return new Response('No source change since the dev server started.\n', { status: 404 });
	}

	return new Response(`${last.result}: ${last.files.join(', ')}: ${last.detail}\n`, {
		status: last.result === 'failed' ? 500 : 200,
	});
}
