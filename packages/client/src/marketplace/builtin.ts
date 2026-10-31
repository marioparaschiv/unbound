import StorePageScreen from '~/ui/marketplace/store-page';
import MarketplacePage from '~/ui/settings/marketplace';
import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

export const marketplaceSection: SectionEntry = {
	key: Screens.Marketplace,
	titleKey: 'UNBOUND_MARKETPLACE',
	component: MarketplacePage,
	icon: 'img_collectibles_shop',
};

export const storePageSection: SectionEntry = {
	key: Screens.StorePage,
	titleKey: 'UNBOUND_STORE_PAGE',
	component: StorePageScreen,
	hidden: true,
};

export default { marketplaceSection, storePageSection };
