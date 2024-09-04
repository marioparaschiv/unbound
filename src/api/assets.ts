import type { Asset } from '@typings/api/assets';
import { initializeModule } from '@api/metro';
import { Assets } from '@api/metro/common';
import Cache from '@core/cache';

export type * from '@typings/api/assets';

export const assets = new Map<number, Asset>();

const cached = Cache.getCachedAssets();

if (cached.length) {
	for (const id of cached) {
		const initialized = initializeModule(id);
		if (!initialized) continue;

		const exported = modules[id].publicModule.exports;
		const asset = Assets.getAssetByID(exported);
		if (!asset) continue;

		assets.set(exported, asset);
	}
} else {
	for (const id in window.modules) {
		const initialized = initializeModule(id);
		if (!initialized) continue;

		const exported = modules[id].publicModule.exports;
		if (typeof exported !== 'number') continue;

		const asset = Assets.getAssetByID(exported);
		if (!asset) continue;

		Cache.addAssetToCache(id);
		assets.set(exported, asset);
	}
}

export function find(filter): Asset | null {
	return [...assets.values()].find(filter as any);
}

export function getByName(name: string, type: 'svg' | 'png' = 'png'): Asset | null {
	return [...assets.values()].find(a => a.name === name && a.type === type);
}

export function getByID(id: number): Asset | null {
	return assets.get(id);
}

export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | null {
	const entry = [...assets.entries()].find(([, asset]) => asset.name === name && asset.type === type);
	return entry?.[0];
}

export function getAll() {
	return [...assets.values()];
}

export const Icons: Record<any, any> = new Proxy({}, {
	get: (_, name: string) => {
		return getIDByName(name);
	}
});

export default { assets, getByName, getByID, getIDByName };