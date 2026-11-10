import type { MetroModuleLoadedOptions, MetroModulePresence } from '~/metro/types';
import { getModuleCacheForKey, isKeyMissing } from '~/metro/cache';
import type { MetroFilter } from '~/metro/filters';
import { CACHE_KEY } from '~/metro/cache-key';
import { find } from '~/metro/search';

/**
 * @description Reports what is known of the module matching `filter`, without loading any module.
 * @param filter The filter to match against.
 * @param options Whether to also match the `default` export, as in {@link onModuleLoaded}.
 * @returns The module's {@link MetroModulePresence}.
 */
export function filterPresence(
	filter: MetroFilter,
	options: MetroModuleLoadedOptions = {},
): MetroModulePresence {
	const key = filter[CACHE_KEY];
	const cached = key ? getModuleCacheForKey(key) : void 0;

	if (isKeyMissing(key)) {
		return 'missing';
	}

	// Cached ids name the module, so only they need testing for whether it has loaded.
	const loaded = find(filter, {
		...options,
		initialize: false,
		cacheOnly: Boolean(cached),
	});

	if (loaded !== null && loaded !== void 0) {
		return 'loaded';
	}

	return cached ? 'present' : 'unknown';
}

export default { filterPresence };
