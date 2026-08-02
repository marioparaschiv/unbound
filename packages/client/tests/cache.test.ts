import { describe, expect, test, beforeEach } from 'bun:test';

import { installSubstrateMocks, installCacheGlobals } from './helpers/metro-fixture';

const settings = installCacheGlobals(2);

// Seed persisted cache whose build disagrees with the native module below, so the import-time
// `isValidCache()` invalidates it.
settings['unbound::cache'] = {
	info: { cacheVersion: 1, buildNumber: 'STALE', moduleCount: 2 },
	modules: { 'byProps::gone': [7] },
	moduleFlags: { 5: 1 },
	assets: [3],
};

installSubstrateMocks('CURRENT');

const cacheModule = await import('~/lib/cache');
const Cache = cacheModule.default;
const { ModuleFlags, invalidateCache } = cacheModule;

describe('isValidCache invalidation at import', () => {
	test('a build-number mismatch wipes the persisted cache on load', () => {
		expect(Cache.getModuleCacheForKey('byProps::gone')).toBeUndefined();
		expect(Cache.getCachedAssets()).toEqual([]);
		expect(Cache.hasModuleFlag(5, ModuleFlags.BLACKLISTED)).toBe(false);
	});
});

describe('module flags', () => {
	beforeEach(() => {
		Cache.state.moduleFlags = {};
	});

	test('set, test, and clear a flag bit', () => {
		expect(Cache.hasModuleFlag(10, ModuleFlags.BLACKLISTED)).toBe(false);

		Cache.addModuleFlag(10, ModuleFlags.BLACKLISTED);
		expect(Cache.hasModuleFlag(10, ModuleFlags.BLACKLISTED)).toBe(true);

		Cache.removeModuleFlag(10, ModuleFlags.BLACKLISTED);
		expect(Cache.hasModuleFlag(10, ModuleFlags.BLACKLISTED)).toBe(false);
	});

	test('clearing a flag on a module that has none is a no-op', () => {
		expect(Cache.removeModuleFlag(11, ModuleFlags.BLACKLISTED)).toBe(true);
		expect(Cache.hasModuleFlag(11, ModuleFlags.BLACKLISTED)).toBe(false);
	});
});

describe('addCachedIDForKey / removeCachedIDForKey twins', () => {
	beforeEach(() => {
		Cache.state.modules = {};
	});

	test('adds an id, dedupes a repeat, and drops the key once empty', () => {
		Cache.addCachedIDForKey('k', 1);
		expect(Cache.getModuleCacheForKey('k')).toEqual([1]);

		Cache.addCachedIDForKey('k', 1);
		expect(Cache.getModuleCacheForKey('k')).toEqual([1]);

		Cache.addCachedIDForKey('k', 2);
		expect(Cache.getModuleCacheForKey('k')).toEqual([1, 2]);

		Cache.removeCachedIDForKey('k', 1);
		expect(Cache.getModuleCacheForKey('k')).toEqual([2]);

		Cache.removeCachedIDForKey('k', 2);
		expect(Cache.getModuleCacheForKey('k')).toBeUndefined();
	});

	test('removing from an absent key is a no-op', () => {
		expect(Cache.removeCachedIDForKey('missing', 1)).toBe(true);
		expect(Cache.getModuleCacheForKey('missing')).toBeUndefined();
	});
});

describe('addAssetToCache / removeAssetFromCache twins', () => {
	beforeEach(() => {
		Cache.state.assets = [];
	});

	test('adds and removes an asset id', () => {
		Cache.addAssetToCache(42);
		expect(Cache.getCachedAssets()).toEqual([42]);

		Cache.removeAssetFromCache(42);
		expect(Cache.getCachedAssets()).toEqual([]);
	});

	test('removing an asset that is not cached leaves the list untouched', () => {
		Cache.addAssetToCache(1);
		Cache.removeAssetFromCache(99);
		expect(Cache.getCachedAssets()).toEqual([1]);
	});
});

describe('invalidateCache', () => {
	test('resets every cache collection to empty', () => {
		Cache.addCachedIDForKey('k', 1);
		Cache.addAssetToCache(9);
		Cache.addModuleFlag(3, ModuleFlags.BLACKLISTED);

		invalidateCache();

		expect(Cache.getModuleCacheForKey('k')).toBeUndefined();
		expect(Cache.getCachedAssets()).toEqual([]);
		expect(Cache.hasModuleFlag(3, ModuleFlags.BLACKLISTED)).toBe(false);
	});
});
