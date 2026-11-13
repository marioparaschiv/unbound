export const DECOR_SKU = '100101099111114';

const CDN = 'https://ugc.decor.fieryflames.dev';
const API = 'https://decor.fieryflames.dev/api';
const IDS_PER_REQUEST = 100;

export type AvatarDecoration = { asset: string; skuId: string };

/**
 * @description Marks a Decor decoration so Discord's avatar code can tell it apart from its own.
 * @param asset The decoration's Decor hash, `a_` first when it is animated.
 * @returns The decoration as Discord stores one.
 */
export function decorDecoration(asset: string): AvatarDecoration {
	return { asset, skuId: DECOR_SKU };
}

/**
 * @description Links a Decor decoration's image, the still frame when it may not animate.
 * @param asset The decoration's Decor hash.
 * @param canAnimate Whether the decoration may animate.
 * @returns The image's link.
 */
export function decorImage(asset: string, canAnimate = false): string {
	const still = asset.startsWith('a_') && !canAnimate ? asset.slice(2) : asset;

	return `${CDN}/${still}.png`;
}

/**
 * @description Splits users into the requests Decor's API takes, a hundred at a time.
 * @param userIds The users to look up.
 * @returns Each request's link.
 */
export function decorRequests(userIds: string[]): string[] {
	const requests: string[] = [];

	for (let start = 0; start < userIds.length; start += IDS_PER_REQUEST) {
		const ids = userIds.slice(start, start + IDS_PER_REQUEST);

		requests.push(`${API}/users?ids=${encodeURIComponent(JSON.stringify(ids))}`);
	}

	return requests;
}
