import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

export const marketplaceSection: SectionEntry = {
	key: Screens.Marketplace,
	titleKey: 'UNBOUND_MARKETPLACE',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/marketplace').default,
	icon: 'img_collectibles_shop',
};

export const addonPageSection: SectionEntry = {
	key: Screens.AddonPage,
	titleKey: 'UNBOUND_STORE_PAGE',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/marketplace/addon-page').default,
	hidden: true,
};
