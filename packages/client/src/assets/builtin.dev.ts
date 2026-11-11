import type { SectionEntry } from '~/settings/section';
import AssetsPage from '~/ui/settings/assets.dev';
import { Screens } from '~/core/constants';

export const assetsSection: SectionEntry = {
	key: Screens.Assets,
	titleKey: 'UNBOUND_ASSET_BROWSER',
	/**
	 * @description Hands Discord's navigator the page.
	 * @returns The page.
	 */
	getComponent: () => AssetsPage,
	hidden: true,
};
