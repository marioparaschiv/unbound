import { CACHE_VERSION } from '@constants';
import { BundleInfo } from '@api/native';
import { getStore } from '@api/storage';


export enum ModuleFlags {
	BLACKLISTED = 1 << 0,
}

export const moduleIds = Object.keys(window.modules);

const CurrentCacheInfo = {
	cacheVersion: CACHE_VERSION,
	buildNumber: BundleInfo.Build,
	moduleCount: moduleIds.length
};

const storage = getStore('unbound::cache');

export const state = {
	info: storage.get('info', CurrentCacheInfo),
	modules: storage.get('modules', {}),
	moduleFlags: storage.get('moduleFlags', {}),
	assets: storage.get('assets', [])
};

if (!isValidCache()) {
	state.info = CurrentCacheInfo;
	state.modules = {};
	state.moduleFlags = {};
	state.assets = [];

	save();
}

export function getCachedAssets() {
	return state.assets;
}

export function addAssetToCache(moduleId: string) {
	state.assets.push(moduleId);
	save();
}

export function removeAssetFromCache(moduleId: string) {
	const idx = state.assets.indexOf(moduleId);
	if (~idx) state.assets.splice(idx, 1);
	save();
}

export function getModuleCacheForKey(key: string) {
	return state.modules[key];
}

export function addCachedIDForKey(key: string, item: string) {
	state.modules[key] ??= [];


	if (state.modules[key].includes(item)) {
		return true;
	}

	state.modules[key].push(item);
	save();
}

export function removeCachedIDForKey(key: string, item: string) {
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

export function addModuleFlag(id: string, flag: ModuleFlags) {
	state.moduleFlags[id] |= flag;
	save();
}

export function removeModuleFlag(id: string, flag: ModuleFlags) {
	if (!state.moduleFlags[id]) return true;

	state.moduleFlags[id] &= ~flag;
	save();
}

export function hasModuleFlag(id: string, flag: ModuleFlags) {
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
	save
};