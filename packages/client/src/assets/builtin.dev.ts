import type { SectionEntry } from '~/settings/section';
import AssetsPage from '~/ui/settings/assets.dev';
import { Screens } from '~/core/constants';

export const assetsSection: SectionEntry = {
	key: Screens.Assets,
	titleKey: 'UNBOUND_ASSET_BROWSER',
	/**
	 *
	 */
	getComponent: () => AssetsPage,
	hidden: true,
};

export default { assetsSection };
