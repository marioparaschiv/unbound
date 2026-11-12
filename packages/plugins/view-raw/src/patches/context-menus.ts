import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { getRawItem, type RawItem } from '~/lib/raw-items';
import { ActionSheets, GuildStore, getViewMainProfileLabel } from '~/lib/modules';
import { sheetState } from '~/lib/sheet-state';
import RawIcon from '~/components/raw-icon';
import { openRawSheet } from '~/lib/sheets';
import { sortKeys } from '~/lib/raw-data';

type MenuItem = {
	label?: string;
	action?: () => void;
	IconComponent?: typeof RawIcon;
};

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

function addItem(menu: ContextMenu, item: RawItem, showIcon: boolean, hideMenu: () => void) {
	if (!Array.isArray(menu.items) || menu.items.some((entry) => entry.label === messages.VIEW_RAW))
		return;

	menu.items.push({
		label: messages.VIEW_RAW,
		action: () => {
			hideMenu();
			openRawSheet(item);
		},
		...(showIcon ? { IconComponent: RawIcon } : {}),
	});
}

/**
 * @description Adds View Raw to a guild's context menu, and to the profile overflow menu of the last opened profile,
 * which the action sheet patch records in `sheetState`. Patches `showContextMenu` on Discord's context menu module.
 */
export function patchContextMenus(): void {
	const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');

	if (!ActionSheets || !ContextMenus) {
		logger.warn('View Raw menu items skipped: Discord moved ActionSheets or ContextMenus.');

		return;
	}

	const hideMenu = () => ContextMenus.hideContextMenu();

	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		if (!menu) return;

		const guild = typeof menu.key === 'string' ? GuildStore.getGuild(menu.key) : undefined;

		if (guild) {
			addItem(menu, { type: 'Guild', data: sortKeys(guild) }, true, hideMenu);

			return;
		}

		const { profileUserId } = sheetState;

		const mainProfileLabel = getViewMainProfileLabel();

		if (
			!profileUserId ||
			!menu.items?.some((item: MenuItem) => item.label === mainProfileLabel)
		) {
			return;
		}

		const profile = getRawItem(`UserProfile${profileUserId}`, { userId: profileUserId });

		if (profile) addItem(menu, profile, false, hideMenu);
	});
}
