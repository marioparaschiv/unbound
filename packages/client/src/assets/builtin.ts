import type { SectionEntry } from '~/settings/section';
import AssetsPage from '~/ui/settings/assets';
import { Screens } from '~/core/constants';

export const assetsSection: SectionEntry = {
	key: Screens.Assets,
	titleKey: 'UNBOUND_ASSET_BROWSER',
	component: AssetsPage,
	hidden: true,
};

export default { assetsSection };
