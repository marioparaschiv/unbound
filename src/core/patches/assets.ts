import { createLogger } from '@structures/logger';
import type { Asset } from '@typings/api/assets';
import { createPatcher } from '@api/patcher';
import { Assets } from '@api/metro/common';
import Icons from '@managers/icons';

const Patcher = createPatcher('unbound-toasts');
const Logger = createLogger('Core', 'Assets');

export async function apply() {
	if (!Assets || !Assets.registerAsset) {
		return Logger.error('Failed to find Toaster API.');
	}

	Patcher.after(Assets, 'registerAsset', (_, [asset]: [Asset], id: number) => {
		Icons.handleAsset(asset, id);
		return id;
	});


	const { assets } = await import('@api/assets');
	for (let id = 1; ; id++) {
		if (assets.has(id)) continue;
		const asset: Asset | undefined = Assets.getAssetByID(id);
		if (!asset) break;

		Icons.handleAsset(asset, id);
	}
}

export function remove() {
	Patcher.unpatchAll();
}