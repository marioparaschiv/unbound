import { isUsrbgData, usrbgBanner, type UsrbgData } from '~/lib/usrbg';

const USRBG_LIST = 'https://usrbg.is-hardly.online/users';

let data: UsrbgData | undefined;

/**
 * @description Downloads the list of USRBG banners in the background.
 */
export async function loadBanners(): Promise<void> {
	try {
		const response = await fetch(USRBG_LIST);
		const body: unknown = await response.json();

		if (isUsrbgData(body)) data = body;
		else logger.warn('Failed to read the USRBG list: it changed shape.');
	} catch (error) {
		logger.error(`Failed to load the USRBG list from ${USRBG_LIST}:`, error);
	}
}

/**
 * @description Looks up a user's USRBG banner.
 * @param userId The user.
 * @returns The banner's link, or `undefined` when the user has none or the list has not loaded.
 */
export function bannerFor(userId: string | undefined): string | undefined {
	return usrbgBanner(data, userId);
}
