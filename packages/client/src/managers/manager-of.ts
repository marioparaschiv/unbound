import type { Plugins } from '~/managers/plugins';
import type { Themes } from '~/managers/themes';
import type { Fonts } from '~/managers/fonts';
import type { Icons } from '~/managers/icons';

/** The manager singleton that governs each addon kind. */
export type ManagerOf = {
	plugin: Plugins;
	theme: Themes;
	'icon-pack': Icons;
	font: Fonts;
};
