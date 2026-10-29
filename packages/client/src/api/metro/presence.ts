import type { MetroModuleLoadedOptions, MetroModulePresence } from '~/api/metro/types';
import { getLazyModule } from '~/api/metro/lazy-registry';
import type { MetroFilter } from '~/api/metro/filters';
import { finder } from '~/api/metro/finders';
import { CACHE_KEY } from '~/lib/constants';
import Cache from '~/lib/cache';

/**
 * @description Reports what is known of the module matching `filter`, without initializing any module.
 * @param filter The filter to match against.
 * @param options Whether to also match the `default` export, as in {@link onModuleLoaded}.
 * @returns The module's {@link MetroModulePresence}.
 */
export function filterPresence(
	filter: MetroFilter,
	options: MetroModuleLoadedOptions = {},
): MetroModulePresence {
	const key = filter[CACHE_KEY];
	const cached = key ? Cache.getModuleCacheForKey(key) : void 0;

	if (cached?.length === 0) {
		return 'missing';
	}

	// Cached ids name the module, so only they need testing for whether it has initialized.
	const loaded = finder('find')(filter, {
		...options,
		initialize: false,
		cacheOnly: Boolean(cached),
	});

	if (loaded !== null && loaded !== void 0) {
		return 'loaded';
	}

	return cached ? 'present' : 'unknown';
}

/**
 * @description Reports what is known of a lazy handle's module, without initializing it or resolving the handle.
 * A plugin should treat `unknown` as present: a patch on the handle waits for the module, so it never applies to nothing.
 * @param handle A lazy handle, such as a `{ lazy: true }` search, `metro.common.*` or `metro.stores.*`.
 * @returns The module's {@link MetroModulePresence}, or `undefined` when `handle` is not a handle a patch waits on.
 */
export function getModulePresence(handle: MetroExport): MetroModulePresence | undefined {
	return getLazyModule(handle)?.presence();
}

export default { filterPresence, getModulePresence };
