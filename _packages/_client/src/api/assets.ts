import type { UnboundAsset } from '@unbound-app/types/assets';
import { initializeModule } from '~/api/metro';
import { Assets } from '~/api/metro/common';
import Cache from '~/lib/cache';


export const assets = new Map<number, UnboundAsset>();

const cached = Cache.getCachedAssets();

if (cached.length) {
	for (const id of cached) {
		const initialized = initializeModule(id);
		if (!initialized) continue;

		const exported = window.modules.get(id).publicModule.exports;
		const asset = Assets.getAssetByID(exported);
		if (!asset) continue;

		assets.set(exported, asset);
	}
} else {
	for (const id of [...window.modules.keys()]) {
		const initialized = initializeModule(id);
		if (!initialized) continue;

		const exported = window.modules.get(id).publicModule.exports;
		if (typeof exported !== 'number') continue;

		const asset = Assets.getAssetByID(exported);
		if (!asset) continue;

		Cache.addAssetToCache(id);
		assets.set(exported, asset);
	}
}

export function find(filter): UnboundAsset | null {
	return [...assets.values()].find(filter as any);
}

export function getByName(name: string, type: 'svg' | 'png' = 'png'): UnboundAsset | null {
	return [...assets.values()].find(a => a.name === name && a.type === type);
}

export function getByID(id: number): UnboundAsset | null {
	return assets.get(id);
}

export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | null {
	const [id] = [...assets.entries()].find(([, asset]) => asset.name === name && asset.type === type) ?? [];

	return id;
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