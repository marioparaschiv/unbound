import type { SectionEntry } from '~/settings/section';
import AddonCount from '~/ui/settings/addon-count';
import PluginsPage from '~/ui/settings/plugins';
import { Screens } from '~/core/constants';

export const pluginsSection: SectionEntry = {
	key: Screens.Plugins,
	titleKey: 'UNBOUND_PLUGINS',
	component: PluginsPage,
	icon: 'PuzzlePieceIcon',
	/**
	 * @description Shows how many plugins are enabled.
	 * @returns The overview row's trailing count.
	 */
	useTrailing: () => <AddonCount kind='plugin' />,
};

export default { pluginsSection };
