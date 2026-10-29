import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import type { MetroModuleLoadedOptions, MetroWaitForModuleOptions } from '~/api/metro/types';
import type { MetroFilter } from '~/api/metro/filters';
import { blacklist, data } from '~/api/metro/state';
import { finder } from '~/api/metro/finders';
import { CACHE_KEY } from '~/lib/constants';
import Cache from '~/lib/cache';

type Waiter = {
	filter: MetroFilter;
	options: MetroModuleLoadedOptions;
	onLoad: (mdl: MetroExport) => void;
	// The uninitialized modules the cache says match, or `null` when any module may match.
	ids: Set<number> | null;
	done: boolean;
	threw: boolean;
};

const Logger = createLogger('Metro', 'Wait');

const waitingById = new Map<number, Set<Waiter>>();
const waitingForAny = new Set<Waiter>();

data.listeners.add(onModuleInitialized);

/**
 * @description Calls `onLoad` with the module matching `filter` once it initializes, without ever initializing it.
 * A module that has already initialized is passed at once; otherwise `onLoad` runs inside the module's factory,
 * before Discord's code that required it receives its exports.
 * @param filter The filter to match against.
 * @param onLoad Receives the matched module, once.
 * @param options Whether to also match the `default` export (`esModules`) and return it on such a match (`interop`).
 * @returns A function that stops waiting; it does nothing once `onLoad` has run.
 */
export function onModuleLoaded(
	filter: MetroFilter,
	onLoad: (mdl: MetroExport) => void,
	options: MetroModuleLoadedOptions = {},
): () => void {
	const loaded = finder('find')(filter, { ...options, initialize: false });

	if (loaded !== null && loaded !== void 0) {
		onLoad(loaded);

		return noop;
	}

	const waiter: Waiter = {
		filter,
		options,
		onLoad,
		ids: pendingCachedIds(filter),
		done: false,
		threw: false,
	};

	if (waiter.ids) {
		for (const id of waiter.ids) {
			let waiting = waitingById.get(id);

			if (!waiting) {
				waiting = new Set();
				waitingById.set(id, waiting);
			}

			waiting.add(waiter);
		}
	} else {
		waitingForAny.add(waiter);
	}

	return () => forget(waiter);
}

/**
 * @description Resolves with the module matching `filter` once it initializes, without ever initializing it.
 * @param filter The filter to match against.
 * @param options The {@link onModuleLoaded} options, plus a `signal` that abandons the wait.
 * @returns A promise of the matched module, or of `undefined` if `signal` aborts first.
 */
export function waitForModule(
	filter: MetroFilter,
	options: MetroWaitForModuleOptions = {},
): Promise<MetroExport> {
	const { signal, ...rest } = options;

	if (signal?.aborted) {
		return Promise.resolve(void 0);
	}

	return new Promise((resolve) => {
		function abort() {
			cancel();
			resolve(void 0);
		}

		const cancel = onModuleLoaded(
			filter,
			(mdl) => {
				signal?.removeEventListener('abort', abort);
				resolve(mdl);
			},
			rest,
		);

		signal?.addEventListener('abort', abort, { once: true });
	});
}

// Cached ids from an earlier launch let a wait skip testing every module that initializes.
function pendingCachedIds(filter: MetroFilter) {
	const key = filter[CACHE_KEY];
	const cached = key ? Cache.getModuleCacheForKey(key) : void 0;

	if (!cached) return null;

	const ids = new Set<number>();

	for (const id of cached) {
		if (!blacklist.has(id) && !window.modules.get(id)?.isInitialized) {
			ids.add(id);
		}
	}

	return ids.size ? ids : null;
}

function onModuleInitialized(exports: MetroExport, id: number) {
	for (const waiter of waitingForAny) {
		settle(waiter, exports, id);
	}

	const waiting = waitingById.get(id);

	if (!waiting) return;

	waitingById.delete(id);

	for (const waiter of waiting) {
		waiter.ids?.delete(id);

		if (settle(waiter, exports, id) || waiter.done || waiter.ids?.size) {
			continue;
		}

		// None of the cached ids matched, so the cache is stale for this filter.
		waiter.ids = null;
		waitingForAny.add(waiter);
	}
}

function settle(waiter: Waiter, exports: MetroExport, id: number) {
	// An earlier `onLoad` in this dispatch may have cancelled this waiter.
	if (waiter.done) {
		return false;
	}

	let found: MetroExport;

	try {
		found = match(waiter, exports, id);
	} catch (error) {
		// As in `find`, a filter that throws on one module still gets tested against the rest.
		if (!waiter.threw) {
			waiter.threw = true;
			Logger.error(`A wait's filter threw on module ${id}:`, error);
		}

		return false;
	}

	if (found === void 0) {
		return false;
	}

	const key = waiter.filter[CACHE_KEY];

	if (key) {
		Cache.addCachedIDForKey(key, id);
	}

	data.cache.set(id, window.modules.get(id));
	forget(waiter);

	try {
		waiter.onLoad(found);
	} catch (error) {
		Logger.error(`Failed to run a wait for module ${id}:`, error);
	}

	return true;
}

// Mirrors the matching in `find`, so a wait and a search for the same filter return the same value.
function match(waiter: Waiter, exports: MetroExport, id: number) {
	const { filter, options } = waiter;
	const { esModules = true, interop = true } = options;

	if (filter.isRaw) {
		const record = window.modules.get(id);

		return record && filter(record, id) ? exports : void 0;
	}

	if (filter(exports, id)) {
		return exports;
	}

	if (!esModules || !exports.default || !filter(exports.default, id)) return;

	return interop ? exports.default : exports;
}

function forget(waiter: Waiter) {
	waiter.done = true;
	waitingForAny.delete(waiter);

	if (!waiter.ids) return;

	for (const id of waiter.ids) {
		const waiting = waitingById.get(id);

		waiting?.delete(waiter);

		if (waiting?.size === 0) {
			waitingById.delete(id);
		}
	}

	waiter.ids.clear();
}

export default { onModuleLoaded, waitForModule };
