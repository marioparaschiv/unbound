import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { getRawItem, type RawItem } from '~/raw/raw-items';
import { ContextMenus, GuildStore, getViewMainProfileLabel } from '~/raw/modules';
import type { SheetState } from '~/raw/action-sheets';
import RawIcon from '~/raw/components/raw-icon';
import { openRawSheet } from '~/raw/sheets';
import { sortKeys } from '~/raw/raw-data';

type MenuItem = {
	label?: string;
	action?: () => void;
	IconComponent?: typeof RawIcon;
};

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

function addItem(menu: ContextMenu, item: RawItem, showIcon: boolean) {
	if (!Array.isArray(menu.items) || menu.items.some((entry) => entry.label === messages.VIEW_RAW))
		return;

	menu.items.push({
		label: messages.VIEW_RAW,
		action: () => {
			ContextMenus.hideContextMenu();
			openRawSheet(item);
		},
		...(showIcon ? { IconComponent: RawIcon } : {}),
	});
}

/**
 * @description Adds View Raw to a guild's context menu, and to the profile overflow menu of the last opened profile.
 * @param state The action sheet patch's record of the last opened profile.
 */
export function patchContextMenus(state: SheetState): void {
	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		if (!menu) return;

		const guild = typeof menu.key === 'string' ? GuildStore.getGuild(menu.key) : undefined;

		if (guild) {
			addItem(menu, { type: 'Guild', data: sortKeys(guild) }, true);

			return;
		}

		const { profileUserId } = state;

		const mainProfileLabel = getViewMainProfileLabel();

		if (
			!profileUserId ||
			!menu.items?.some((item: MenuItem) => item.label === mainProfileLabel)
		) {
			return;
		}

		const profile = getRawItem(`UserProfile${profileUserId}`, { userId: profileUserId });

		if (profile) addItem(menu, profile, false);
	});
}

export default patchContextMenus;
