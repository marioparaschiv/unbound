import type { AddonKind } from '@unbound-app/types/addons';

import type { Icons } from '~/icon-packs/manager';
import type { Plugins } from '~/plugins/manager';
import type { Themes } from '~/themes/manager';
import type { Fonts } from '~/fonts/manager';

/** The manager singleton that governs each addon kind. */
export type ManagerOf = {
	plugin: Plugins;
	theme: Themes;
	'icon-pack': Icons;
	font: Fonts;
};

/** The kinds installed from a manifest, so their addons update and hold by version. */
export type UpdatableKind = Exclude<AddonKind, 'font'>;
