import type { SectionEntry } from '~/settings/section';
import PluginsPage from '~/ui/settings/plugins';
import { Screens } from '~/core/constants';

/** The Plugins page. */
export const pluginsSection: SectionEntry = {
	key: Screens.Plugins,
	title: 'UNBOUND_PLUGINS',
	component: PluginsPage,
	icon: 'PuzzlePieceIcon',
};

export default { pluginsSection };
