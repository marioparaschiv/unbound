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

type CacheState = {
	info: typeof CurrentCacheInfo;
	modules: Record<string, number[]>;
	moduleFlags: Record<number, number>;
	// `name.type` of an asset to the id of the module that registers it.
	assets: Record<string, number>;
};

export const state: CacheState = {
	info: storage.get('info', CurrentCacheInfo),
	modules: storage.get('modules', {}),
	moduleFlags: storage.get('moduleFlags', {}),
	assets: storage.get('assets', {}),
};

if (!isValidCache()) {
	invalidateCache();
}

/**
 * @description Resets the cache to a clean slate, clearing all cached module ids, flags, and assets, then persists it.
 */
function invalidateCache() {
	state.info = CurrentCacheInfo;
	state.modules = {};
	state.moduleFlags = {};
	state.assets = {};

	save();
}

/**
 * @description Returns the id of the module that registers an asset.
 * @param key The asset's `name.type`.
 * @returns The asset module's id, or `undefined` if none is cached.
 */
export function getCachedAssetModule(key: string): number | undefined {
	return state.assets[key];
}

/**
 * @description Records the module that registers an asset, persisting if it changed. Twin of {@link removeAssetFromCache}.
 * @param key The asset's `name.type`.
 * @param moduleId The id of the asset module that registers it.
 * @returns `true` if that module was already cached for the asset, otherwise `undefined`.
 */
export function addAssetToCache(key: string, moduleId: number) {
	if (state.assets[key] === moduleId) {
		return true;
	}

	state.assets[key] = moduleId;
	save();
}

/**
 * @description Forgets the module that registers an asset, persisting if it was cached. Twin of {@link addAssetToCache}.
 * @param key The asset's `name.type`.
 * @returns `true` if no module was cached for the asset, otherwise `undefined`.
 */
export function removeAssetFromCache(key: string) {
	if (state.assets[key] === void 0) {
		return true;
	}

	delete state.assets[key];
	save();
}

/**
 * @description Returns the cached module ids stored under a filter's cache key.
 * @param key The cache key to look up.
 * @returns The cached module ids for the key, an empty list when no module matches, or `undefined` if none are cached.
 */
export function getModuleCacheForKey(key: string) {
	return state.modules[key];
}

/**
 * @description Records a module id under a cache key, persisting if it was not already present. Twin of {@link removeCachedIDForKey}.
 * @param key The cache key to add the id under.
 * @param item The module id to cache.
 * @returns `true` if the id was already cached under the key, otherwise `undefined`.
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
 * @description Records that no module in this build matches a cache key, as an empty id list.
 * @param key The cache key no module matches.
 */
export function markKeyMissing(key: string) {
	state.modules[key] = [];
	save();
}

/**
 * @description Removes a module id from a cache key, dropping the key entirely once empty, and persists. Twin of {@link addCachedIDForKey}.
 * @param key The cache key to remove the id from.
 * @param item The module id to uncache.
 * @returns Always `true`.
 */
function removeCachedIDForKey(key: string, item: number) {
	const store = state.modules[key];

	if (!store) {
		return true;
	}

	const idx = store.indexOf(item);

	if (~idx) {
		store.splice(idx, 1);
	}

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
 * @returns `true` if the module had no flags set, otherwise `undefined`.
 */
function removeModuleFlag(id: number, flag: ModuleFlags) {
	if (!state.moduleFlags[id]) {
		return true;
	}

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
	if (!state.moduleFlags[id]) {
		return false;
	}

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
	getCachedAssetModule,
	addAssetToCache,
	removeAssetFromCache,
	getModuleCacheForKey,
	addCachedIDForKey,
	markKeyMissing,
	removeCachedIDForKey,
	addModuleFlag,
	hasModuleFlag,
	removeModuleFlag,
	save,
};
