import type { SectionEntry } from '~/settings/section';
import PluginsPage from '~/ui/settings/plugins';
import { Screens } from '~/core/constants';

export const pluginsSection: SectionEntry = {
	key: Screens.Plugins,
	titleKey: 'UNBOUND_PLUGINS',
	component: PluginsPage,
	icon: 'PuzzlePieceIcon',
};

export default { pluginsSection };
