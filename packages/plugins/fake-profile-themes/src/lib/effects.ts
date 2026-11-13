import { flux, metro } from '@unbound-app/api';

import '~/lib/types';

/** A profile effect from Discord's shop, as the picker shows it. */
export type ProfileEffect = { skuId: string; title: string; thumbnailPreviewSrc?: string };

type ShopItem = Partial<ProfileEffect> & { type?: number };

type ShopProduct = { items?: ShopItem[] };

const PROFILE_EFFECT = 1;

const isEffect = (item: ShopItem): item is ProfileEffect & { type: number } =>
	item.type === PROFILE_EFFECT && typeof item.skuId === 'string';

/**
 * @description Lists the profile effects among shop products, each once and sorted by title.
 * @param products The shop's products.
 * @returns The effects.
 */
export function profileEffects(products: Iterable<ShopProduct>): ProfileEffect[] {
	const effects = new Map<string, ProfileEffect>();

	for (const product of products) {
		for (const item of product.items ?? []) {
			if (isEffect(item) && !effects.has(item.skuId)) {
				effects.set(item.skuId, {
					skuId: item.skuId,
					title: item.title ?? item.skuId,
					thumbnailPreviewSrc: item.thumbnailPreviewSrc,
				});
			}
		}
	}

	return [...effects.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * @description Reads the shop products Discord has loaded.
 * @returns The products, empty until the shop's categories are fetched.
 */
export function loadedProducts(): ShopProduct[] {
	const products = flux.getStore('CollectiblesCategory').products;

	return products ? ([...products.values()] as ShopProduct[]) : [];
}

/**
 * @description Asks Discord to load the shop's categories, which hold every profile effect.
 */
export function fetchShop(): void {
	const actions = metro.findByProps(
		'fetchCollectiblesCategories',
		'maybeFetchCollectiblesProduct',
	);

	try {
		actions?.fetchCollectiblesCategories();
	} catch (error) {
		logger.error('Failed to fetch the collectibles shop:', error);
	}
}
