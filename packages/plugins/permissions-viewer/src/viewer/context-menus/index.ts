import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { contextMenuTarget, type ContextMenu } from '~/viewer/context-menus/targets';
import { hasPermissionsView, viewForTarget } from '~/viewer/permissions/views';
import { ContextMenus, GuildStore, Icons } from '~/viewer/modules';
import type { SheetState } from '~/viewer/action-sheets';
import { openPermissionsSheet } from '~/viewer/sheets';

/**
 * @description Adds View Permissions to a server's menu, for its roles, and to user menus inside a server and the overflow menu of a server profile, for that member's roles.
 * Patches `showContextMenu` on Discord's context menu module (`showContextMenu`, `hideContextMenu`). The menu's `user`, `userId`, `guildId`, `context` and `guild` fields are read first, then a key that is an ID in `GuildStore`; the profile overflow menu carries no user, so it is recognized by its items and paired with the open server profile.
 * @param state The action sheet patch's record of the open server profile.
 */
export function patchContextMenus(state: SheetState): void {
	patcher.before(
		ContextMenus,
		'showContextMenu',
		({ args: [menu] }: { args: [ContextMenu?] }) => {
			if (!menu || !Array.isArray(menu.items)) return;

			const target = contextMenuTarget(menu, state.profile, (id) =>
				Boolean(GuildStore.getGuild(id)),
			);

			if (!target || !hasPermissionsView(target)) return;

			const label = messages.VIEW_PERMISSIONS;

			if (menu.items.some((item) => item.label === label)) return;

			menu.items.push({
				label,
				IconComponent: Icons.ShieldUserIcon,
				action: () => {
					ContextMenus.hideContextMenu();

					const view = viewForTarget(target);

					if (view) openPermissionsSheet(view);
				},
			});
		},
	);
}
