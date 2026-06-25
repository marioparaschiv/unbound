import { CACHE_VERSION } from '~/lib/constants';
import { BundleInfo } from '~/api/native';
import { getStore } from '~/api/storage';

/** Bitwise flags tracking per-module state; `BLACKLISTED` marks a module that must never be returned from a search. */
export enum ModuleFlags {
	BLACKLISTED = 1 << 0,
}

export const moduleIds = [...window.modules.keys()];

const CurrentCacheInfo = {
	cacheVersion: CACHE_VERSION,
	buildNumber: BundleInfo.Build,
	moduleCount: moduleIds.length,
};

const storage = getStore('unbound::cache');

interface CacheState {
	info: typeof CurrentCacheInfo;
	modules: Record<string, number[]>;
	moduleFlags: Record<number, number>;
	assets: number[];
}

export const state: CacheState = {
	info: storage.get('info', CurrentCacheInfo),
	modules: storage.get('modules', {}),
	moduleFlags: storage.get('moduleFlags', {}),
	assets: storage.get('assets', []),
};

if (!isValidCache()) {
	invalidateCache();
}

/**
 * @description Resets the cache to a clean slate, clearing all cached module ids, flags, and assets, then persists it.
 */
export function invalidateCache() {
	state.info = CurrentCacheInfo;
	state.modules = {};
	state.moduleFlags = {};
	state.assets = [];

	save();
}

/**
 * @description Returns the list of cached asset module ids.
 * @returns The cached asset module ids.
 */
export function getCachedAssets() {
	return state.assets;
}

/**
 * @description Adds an asset module id to the cache and persists it. Twin of {@link removeAssetFromCache}.
 * @param moduleId The id of the asset module to cache.
 */
export function addAssetToCache(moduleId: number) {
	state.assets.push(moduleId);
	save();
}

/**
 * @description Removes an asset module id from the cache and persists it. Twin of {@link addAssetToCache}.
 * @param moduleId The id of the asset module to uncache.
 */
export function removeAssetFromCache(moduleId: number) {
	const idx = state.assets.indexOf(moduleId);
	if (~idx) state.assets.splice(idx, 1);
	save();
}

/**
 * @description Returns the cached module ids stored under a filter's cache key.
 * @param key The cache key to look up.
 * @returns The cached module ids for the key, or `undefined` if none are cached.
 */
export function getModuleCacheForKey(key: string) {
	return state.modules[key];
}

/**
 * @description Records a module id under a cache key, persisting if it was not already present. Twin of {@link removeCachedIDForKey}.
 * @param key The cache key to add the id under.
 * @param item The module id to cache.
 */
export function addCachedIDForKey(key: string, item: number) {
	state.modules[key] ??= [];

	if (state.modules[key].includes(item)) {
		return true;
	}

	state.modules[key].push(item);
	save();
}

/**
 * @description Removes a module id from a cache key, dropping the key entirely once empty, and persists. Twin of {@link addCachedIDForKey}.
 * @param key The cache key to remove the id from.
 * @param item The module id to uncache.
 */
export function removeCachedIDForKey(key: string, item: number) {
	const store = state.modules[key];
	if (!store) return true;

	const idx = store.indexOf(item);
	if (~idx) store.splice(idx, 1);

	if (!store.length) {
		delete state.modules[key];
	}

	save();

	return true;
}

/**
 * @description Sets a {@link ModuleFlags} bit on a module and persists. Twin of {@link removeModuleFlag}.
 * @param id The id of the module to flag.
 * @param flag The flag bit to set.
 */
export function addModuleFlag(id: number, flag: ModuleFlags) {
	state.moduleFlags[id] |= flag;
	save();
}

/**
 * @description Clears a {@link ModuleFlags} bit from a module and persists. Twin of {@link addModuleFlag}.
 * @param id The id of the module to unflag.
 * @param flag The flag bit to clear.
 */
export function removeModuleFlag(id: number, flag: ModuleFlags) {
	if (!state.moduleFlags[id]) return true;

	state.moduleFlags[id] &= ~flag;
	save();
}

/**
 * @description Tests whether a {@link ModuleFlags} bit is set on a module.
 * @param id The id of the module to test.
 * @param flag The flag bit to test for.
 * @returns `true` if the flag is set on the module.
 */
export function hasModuleFlag(id: number, flag: ModuleFlags) {
	if (!state.moduleFlags[id]) return false;

	return Boolean(state.moduleFlags[id] & flag);
}

function isValidCache() {
	if (BundleInfo.Build !== state.info.buildNumber) {
		return false;
	}

	if (moduleIds.length !== state.info.moduleCount) {
		return false;
	}

	if (CACHE_VERSION !== state.info.cacheVersion) {
		return false;
	}

	return true;
}

function save() {
	storage.set('info', state.info);
	storage.set('modules', state.modules);
	storage.set('moduleFlags', state.moduleFlags);
	storage.set('assets', state.assets);
}

export default {
	state,
	moduleIds,
	getCachedAssets,
	addAssetToCache,
	removeAssetFromCache,
	getModuleCacheForKey,
	addCachedIDForKey,
	removeCachedIDForKey,
	addModuleFlag,
	hasModuleFlag,
	removeModuleFlag,
	save,
};
