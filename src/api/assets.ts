import { createLogger } from '@structures/logger';
import type { Asset } from '@typings/api/assets';
import IconManager from '@managers/icons';
import { createPatcher } from '@patcher';
import { findByProps } from '@api/metro';
import { Image } from 'react-native';
import fs from '@api/fs';

export type * from '@typings/api/assets';

export const assets = new Set<Asset>();
export const registry = findByProps('registerAsset', { lazy: true });

const Logger = createLogger('Assets');
const Patcher = createPatcher('unbound-assets');

function initialize() {
	IconManager.initialize();

	Patcher.after(registry, 'registerAsset', (_, [asset]: [Asset], id: number) => {
		Object.assign(asset, { id });
		assets.add(asset);
		handleScales(asset, id);

		IconManager.applyIconPath(IconManager.applied.manifest.id, asset);
	});

	for (let id = 1; ; id++) {
		const asset: Asset | undefined = registry.getAssetByID(id);

		if (!asset) break;

		handleScales(asset, id);

		if (!assets.has(asset)) {
			Object.assign(asset, { id });
			assets.add(asset);
		};

		IconManager.applyIconPath(IconManager.applied.manifest.id, asset);
	}

	IconManager.applyImagePatch(IconManager.applied.manifest.id);
}

async function handleScales(asset: Asset, id: number) {
	asset.scales.sort((a, b) => b - a);

	for (const scale of asset.scales) {
		const uri = Image.resolveAssetSource(id).uri;
		const fileExists = await fs.exists(uri.replace('file:/', ''), false);

		if (!fileExists) {
			asset.scales = asset.scales.filter(x => x !== scale);
		};
	}
}

export function find(filter): Asset | null {
	return Object.values(assets).find(filter as any);
}

export function getByName(name: string, type: 'svg' | 'png' = 'png'): Asset | null {
	return [...assets].find(a => a.name === name && a.type === type);
}

export function getByID(id: number): Asset | null {
	return registry.getAssetByID(id);
}

export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | null {
	return getByName(name, type)?.id;
}

export function getAll() {
	return [...assets];
}

export const Icons: Record<any, any> = new Proxy({}, {
	get: (_, name: string) => {
		return getIDByName(name);
	}
});

try {
	initialize();
} catch (e) {
	Logger.error('Failed to initialize assets:', e.message);
}

export default { assets, getByName, getByID, getIDByName };