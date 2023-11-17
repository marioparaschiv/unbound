import type { Asset } from '@typings/api/assets';
import IconManager from '@managers/icons';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { findByProps } from '@metro';

export const assets = new Set<Asset>();
export const registry = findByProps('registerAsset');

const Logger = createLogger('Assets');
const Patcher = createPatcher('unbound-assets');

function initialize() {
	IconManager.initialize();

	Patcher.after(registry, 'registerAsset', (_, [asset]: [Asset], id: number) => {
		Object.assign(asset, { id });
		assets.add(asset);

		IconManager.applyIconPath(IconManager.applied.manifest.id, asset);
	});

	for (let id = 1; ; id++) {
		const asset: Asset | undefined = registry.getAssetByID(id);

		if (!asset) break;

		if (!assets.has(asset)) {
			Object.assign(asset, { id });
			assets.add(asset);
		};

		IconManager.applyIconPath(IconManager.applied.manifest.id, asset);
	}

	IconManager.applyImagePatch(IconManager.applied.manifest.id);
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