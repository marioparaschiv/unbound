import type { UnboundAsset } from '@unbound-app/types/assets';

import { initializeModule } from '~/api/metro';
import { Assets } from '~/api/metro/common';
import Cache from '~/lib/cache';

/** Map of discovered asset ids to their resolved {@link UnboundAsset} record. */
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

/**
 * @description Finds the first known asset matching the given predicate.
 * @param filter Predicate run against each asset.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none match.
 */
export function find(filter: (asset: UnboundAsset) => boolean): UnboundAsset | undefined {
	return [...assets.values()].find(filter);
}

/**
 * @description Finds a known asset by its name and type.
 * @param name The asset name to match.
 * @param type The asset type to match.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none match.
 */
export function getByName(name: string, type: 'svg' | 'png' = 'png'): UnboundAsset | undefined {
	return [...assets.values()].find((a) => a.name === name && a.type === type);
}

/**
 * @description Looks up a known asset by its id.
 * @param id The asset id to look up.
 * @returns The matched {@link UnboundAsset}, or `undefined` if none is registered for that id.
 */
export function getByID(id: number): UnboundAsset | undefined {
	return assets.get(id);
}

/**
 * @description Looks up a known asset's id by its name and type.
 * @param name The asset name to match.
 * @param type The asset type to match.
 * @returns The matched asset's id, or `undefined` if none match.
 */
export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | undefined {
	const [id] =
		[...assets.entries()].find(([, asset]) => asset.name === name && asset.type === type) ?? [];
	return id;
}

/**
 * @description Returns every known asset.
 * @returns An array of all registered {@link UnboundAsset} records.
 */
export function getAll(): UnboundAsset[] {
	return [...assets.values()];
}

/** Proxy resolving any property name to its asset id via {@link getIDByName}. */
export const Icons: Record<string, number | undefined> = new Proxy(
	{},
	{
		get: (_, name: string) => {
			return getIDByName(name);
		},
	},
);

export default { assets, find, getByName, getByID, getIDByName, getAll, Icons };
