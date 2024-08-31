import { createLogger } from '@structures/logger';
import type { Asset } from '@typings/api/assets';
import { Assets } from '@api/metro/common';
import IconManager from '@managers/icons';

export type * from '@typings/api/assets';

export const assets = new Map<number, Asset>();

const Logger = createLogger('API', 'Assets');

function initialize() {
	IconManager.initialize();
}

export function find(filter): Asset | null {
	return [...assets.values()].find(filter as any);
}

export function getByName(name: string, type: 'svg' | 'png' = 'png'): Asset | null {
	return [...assets.values()].find(a => a.name === name && a.type === type);
}

export function getByID(id: number): Asset | null {
	return Assets.getAssetByID(id);
}

export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | null {
	return getByName(name, type)?.id;
}

export function getAll() {
	return [...assets.values()];
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