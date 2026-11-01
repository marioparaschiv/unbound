import { CACHE_VERSION } from '~/core/constants';
import { BundleInfo } from '~/native/native';
import { getBucket } from '~/storage/api';

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

const storage = getBucket('unbound::cache');

const SAVE_DELAY_MS = 1000;
const unsaved = new Set<keyof CacheState>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** A module a cache key matched in an earlier Discord build: its id there and, for a Discord module, its file path. */
export type ModuleHint = {
	id: number;
	path?: string;
};

type CacheState = {
	info: typeof CurrentCacheInfo;
	modules: Record<string, number[]>;
	moduleFlags: Record<number, number>;
	// `name.type` of an asset to the id of the module that registers it.
	assets: Record<string, number>;
	// Every asset module of this build has registered once, so `assets` names every asset.
	assetsComplete: boolean;
	// File path of each cached module that has one, so a later build can recognise the same module.
	paths: Record<number, string>;
	// Each key's modules in an earlier Discord build. Ids move by a few between builds, so a search tries near them.
	hints: Record<string, ModuleHint[]>;
};

export const state: CacheState = {
	info: storage.get('info', CurrentCacheInfo),
	modules: storage.get('modules', {}),
	moduleFlags: storage.get('moduleFlags', {}),
	assets: storage.get('assets', {}),
	assetsComplete: storage.get('assetsComplete', false),
	paths: storage.get('paths', {}),
	hints: storage.get('hints', {}),
};

if (!isValidCache()) {
	invalidateCache();
}

/**
 * @description Resets the cache to a clean slate, clearing all cached module ids, flags, and assets, then persists it.
 */
function invalidateCache() {
	state.hints = carryHints();
	state.info = CurrentCacheInfo;
	state.modules = {};
	state.moduleFlags = {};
	state.paths = {};
	state.assets = {};
	state.assetsComplete = false;

	save('hints', 'info', 'modules', 'moduleFlags', 'paths', 'assets', 'assetsComplete');
}

// Keeps the modules each key matched in the outgoing build, and older hints for keys it never matched.
function carryHints() {
	const hints = { ...state.hints };

	for (const key in state.modules) {
		if (state.modules[key].length) {
			hints[key] = state.modules[key].map((id) => ({ id, path: state.paths[id] }));
		}
	}

	return hints;
}

/**
 * @description Returns the modules a cache key matched in an earlier Discord build.
 * @param key The cache key to look up.
 * @returns The key's modules from an earlier build, or `undefined` if it has none.
 */
export function getHintsForKey(key: string): ModuleHint[] | undefined {
	return state.hints[key];
}

/**
 * @description Records that every asset module of this build has registered, so a name missing from the cache does not exist.
 */
export function markAssetsComplete() {
	state.assetsComplete = true;
	save('assetsComplete');
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
	save('assets');
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
	save('assets');
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

	const path = window.modules.get(item)?.__filePath;

	if (path) {
		state.paths[item] = path;
	}

	state.modules[key].push(item);
	save('modules', 'paths');
}

/**
 * @description Records that no module in this build matches a cache key, as an empty id list.
 * @param key The cache key no module matches.
 */
export function markKeyMissing(key: string) {
	state.modules[key] = [];
	save('modules');
}

/**
 * @description Tests whether a full scan of this build found no module for a cache key.
 * @param key The cache key to test, if the filter has one.
 * @returns `true` if the key is marked missing.
 */
export function isKeyMissing(key: string | undefined) {
	return key !== void 0 && state.modules[key]?.length === 0;
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

	save('modules');

	return true;
}

/**
 * @description Sets a {@link ModuleFlags} bit on a module and persists. Twin of {@link removeModuleFlag}.
 * @param id The id of the module to flag.
 * @param flag The flag bit to set.
 */
export function addModuleFlag(id: number, flag: ModuleFlags) {
	state.moduleFlags[id] |= flag;
	save('moduleFlags');
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
	save('moduleFlags');
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

/**
 * @description Persists the named fields within {@link SAVE_DELAY_MS}. A burst of changes, such as every asset
 * registering on a cold cache, stages each field once instead of every field once per change.
 * @param fields The fields that changed.
 */
function save(...fields: [keyof CacheState, ...(keyof CacheState)[]]) {
	// A later launch trusts saved fields only under the saved `info`, which a new, empty cache never changes.
	unsaved.add('info');

	for (const field of fields) {
		unsaved.add(field);
	}

	saveTimer ??= setTimeout(() => {
		saveTimer = undefined;

		for (const field of unsaved) {
			storage.set(field, state[field]);
		}

		unsaved.clear();
	}, SAVE_DELAY_MS);
}

export default {
	state,
	moduleIds,
	getCachedAssetModule,
	addAssetToCache,
	removeAssetFromCache,
	markAssetsComplete,
	getModuleCacheForKey,
	getHintsForKey,
	addCachedIDForKey,
	markKeyMissing,
	isKeyMissing,
	removeCachedIDForKey,
	addModuleFlag,
	hasModuleFlag,
	removeModuleFlag,
	save,
};
