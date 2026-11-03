import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';

import { contextMenuTarget, type ContextMenu } from '~/context-menus/targets';
import { hasPermissionsView, viewForTarget } from '~/permissions/views';
import { ContextMenusFilter, GuildStore } from '~/discord/modules';
import type { SheetState } from '~/action-sheets';
import { openPermissionsSheet } from '~/sheets';
import { ROW_LABEL } from '~/constants';

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

/**
 * @description Adds View Permissions to a server's menu, for its roles, and to user menus inside a server and the overflow menu of a server profile, for that member's roles.
 * Patches `showContextMenu` on Discord's context menu module (`showContextMenu`, `hideContextMenu`). The menu's `user`, `userId`, `guildId`, `context` and `guild` fields are read first, then a key that is an ID in `GuildStore`; the profile overflow menu carries no user, so it is recognized by its items and paired with the open server profile.
 * @param state The action sheet patch's record of the open server profile.
 * @returns A function that removes the patch, or stops waiting for Discord's context menu module.
 */
export function patchContextMenus(state: SheetState): () => void {
	return whenLoaded<ContextMenuHost>(ContextMenusFilter, (ContextMenus) =>
		patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
			if (!menu || !Array.isArray(menu.items)) return;

			const target = contextMenuTarget(menu, state.profile, (id) =>
				Boolean(GuildStore.getGuild(id)),
			);

			if (!target || !hasPermissionsView(target)) return;

			if (menu.items.some((item) => item.label === ROW_LABEL)) return;

			menu.items.push({
				label: ROW_LABEL,
				action: () => {
					ContextMenus.hideContextMenu();

					const view = viewForTarget(target);

					if (view) openPermissionsSheet(view);
				},
			});
		}),
	);
}
