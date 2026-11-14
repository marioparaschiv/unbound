import { parseIdList } from '@unbound-plugins/shared/entities/id-list';

import { cleanChannelName, type CleanOptions } from './clean';

const MAX_NAMES = 5000;

/** Cleans names and parses the kept list once per distinct input, since Discord reads channel names thousands of times. */
export type NameCache = {
	clean(name: string, type: number | undefined, options: CleanOptions): string;
	isKept(id: string, kept: string): boolean;
};

/**
 * @description Creates a cache for cleaned channel names and the kept channel list.
 * @returns The cache.
 */
export function createNameCache(): NameCache {
	const names = new Map<string, string>();
	let keptSource: string | undefined;
	let keptIds = new Set<string>();

	return {
		clean(name, type, options) {
			const key = `${options.spaces ? 1 : 0}:${type ?? ''}:${name}`;
			const cached = names.get(key);

			if (cached !== undefined) return cached;

			if (names.size >= MAX_NAMES) names.clear();

			const value = cleanChannelName(name, type, options);

			names.set(key, value);

			return value;
		},
		isKept(id, kept) {
			if (kept !== keptSource) {
				keptSource = kept;
				keptIds = new Set(parseIdList(kept));
			}

			return keptIds.has(id);
		},
	};
}

export default createNameCache;
