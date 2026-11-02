import type { ModuleHint } from '~/metro/cache';

/** Everything `~/metro/cache` exports, so a test replaces the module without leaving a reader undefined. */
export type CacheMock = {
	ModuleFlags: { BLACKLISTED: number };
	state: { moduleFlags: Record<number, number>; assetsComplete?: boolean };
	moduleIds: number[];
	hasModuleFlag: (id: number, flag: number) => boolean;
	addModuleFlag: (id: number, flag: number) => void;
	getModuleCacheForKey: (key: string) => number[] | undefined;
	isKeyMissing: (key?: string) => boolean;
	getHintsForKey: (key: string) => ModuleHint[] | undefined;
	addCachedIDForKey: (key: string, id: number) => void;
	markKeyMissing: (key: string) => void;
	getCachedAssetModule: (key: string) => number | undefined;
	addAssetToCache: (key: string, id: number) => void;
	removeAssetFromCache: (key: string) => void;
	markAssetsComplete: () => void;
};

/**
 * @description Builds the stand-in a test gives `mock.module` for `~/metro/cache`: every export the
 * metro modules read, answering nothing, with the fields the test cares about overridden.
 * @param overrides The exports the test replaces.
 * @returns The mocked cache module.
 */
export function createCacheMock(overrides: Partial<CacheMock> = {}): CacheMock {
	return {
		ModuleFlags: { BLACKLISTED: 1 },
		state: { moduleFlags: {} },
		moduleIds: [],
		hasModuleFlag: () => false,
		addModuleFlag: () => undefined,
		getModuleCacheForKey: () => undefined,
		isKeyMissing: () => false,
		getHintsForKey: () => undefined,
		addCachedIDForKey: () => undefined,
		markKeyMissing: () => undefined,
		getCachedAssetModule: () => undefined,
		addAssetToCache: () => undefined,
		removeAssetFromCache: () => undefined,
		markAssetsComplete: () => undefined,
		...overrides,
	};
}
