import MarketplacePage from '~/ui/settings/marketplace';
import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

/** The Marketplace page. */
export const marketplaceSection: SectionEntry = {
	key: Screens.Marketplace,
	title: 'UNBOUND_MARKETPLACE',
	component: MarketplacePage,
	icon: 'img_collectibles_shop',
};

export default { marketplaceSection };
