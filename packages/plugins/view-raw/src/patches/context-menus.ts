import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { ContextMenusFilter, GuildStore, Patcher } from '~/modules';
import { getRawItem, type RawItem } from '~/raw-items';
import { openRawSheet } from '~/sheets';
import type { SheetState } from '~/patches/action-sheets';
import RawIcon from '~/components/raw-icon';
import { sortKeys } from '~/raw-data';

type MenuItem = {
	label?: string;
	action?: () => void;
	IconComponent?: typeof RawIcon;
};

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

function addItem(menu: ContextMenu, item: RawItem, close: () => void, showIcon: boolean) {
	if (!Array.isArray(menu.items) || menu.items.some((entry) => entry.label === 'View Raw'))
		return;

	menu.items.push({
		label: 'View Raw',
		action: () => {
			close();
			openRawSheet(item);
		},
		...(showIcon ? { IconComponent: RawIcon } : {}),
	});
}

/**
 * @description Adds View Raw to a guild's context menu, and to the profile overflow menu of the last opened profile.
 * @param state The action sheet patch's record of the last opened profile.
 * @returns A function that removes the patch, or stops waiting for Discord's context menu module.
 */
export function patchContextMenus(state: SheetState): () => void {
	return whenLoaded<ContextMenuHost>(ContextMenusFilter, (ContextMenus) => {
		function close() {
			ContextMenus.hideContextMenu();
		}

		return Patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
			if (!menu) return;

			const guild = typeof menu.key === 'string' ? GuildStore.getGuild(menu.key) : undefined;

			if (guild) {
				addItem(menu, { type: 'Guild', data: sortKeys(guild) }, close, true);

				return;
			}

			const { profileUserId } = state;

			if (!profileUserId || !menu.items?.some((item) => item.label === 'View Main Profile')) {
				return;
			}

			const profile = getRawItem(`UserProfile${profileUserId}`, { userId: profileUserId });

			if (profile) addItem(menu, profile, close, false);
		});
	});
}

export default patchContextMenus;
