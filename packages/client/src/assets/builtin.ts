import type { SectionEntry } from '~/settings/section';
import AssetsPage from '~/ui/settings/assets';
import { Screens } from '~/core/constants';

/** The hidden asset browser, opened from the Developer page. */
export const assetsSection: SectionEntry = {
	key: Screens.Assets,
	title: 'UNBOUND_ASSET_BROWSER',
	component: AssetsPage,
	hidden: true,
};

export default { assetsSection };
