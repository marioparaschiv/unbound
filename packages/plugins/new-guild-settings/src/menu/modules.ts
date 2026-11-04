import { flux, metro } from '@unbound-app/api';

import type { MenuItem } from '~/menu/menu-targets';

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

export const { ActionSheets } = metro.api;
export const ContextMenus: ContextMenuHost = metro.findByProps(
	'showContextMenu',
	'hideContextMenu',
);
export const Icons = metro.findByProps('SettingsIcon');
export const GuildStore = flux.getStore('Guild');
