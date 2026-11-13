import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { bannerFor } from '~/lib/banners';

type DisplayProfile = { userId?: string };

/**
 * @description Shows USRBG banners on profiles, behind a Nitro banner when the user has one and the setting prefers it.
 * Patches `getBannerURL` on Discord's `DisplayProfile` records.
 */
export function patchBannerUrls(): void {
	const DisplayProfile = metro.findByPrototypes('getBannerURL', 'getPreviewBanner');

	if (typeof DisplayProfile?.prototype?.getBannerURL !== 'function') {
		logger.warn('USRBG banners skipped: Discord moved DisplayProfile.getBannerURL.');

		return;
	}

	patcher.after(DisplayProfile.prototype, 'getBannerURL', ({ result, this: profile }) => {
		if (result && settings.nitroFirst) return result;

		return bannerFor((profile as DisplayProfile).userId) ?? result;
	});
}
