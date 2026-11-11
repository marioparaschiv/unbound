import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { contextMenuTarget, type ContextMenu } from '~/lib/menu-targets';
import { hasPermissionsView, viewForTarget } from '~/lib/views';
import { Constants, GuildStore } from '~/lib/modules';
import { sheetState as state } from '~/lib/sheet-state';
import { openPermissionsSheet } from '~/lib/sheets';

/**
 * @description Adds View Permissions to a server's menu, for its roles, and to user menus inside a server and the overflow menu of a server profile, for that member's roles.
 * Patches `showContextMenu` on Discord's context menu module (`showContextMenu`, `hideContextMenu`). The menu's `user`, `userId`, `guildId`, `context` and `guild` fields are read first, then a key that is an ID in `GuildStore`; the profile overflow menu carries no user, so it is recognized by its items and paired with the open server profile.
 * Reads the open server profile from the shared sheet state the action sheet patch records.
 */
export function patchContextMenus(): void {
	const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');
	const Icons = metro.findByProps('ShieldUserIcon');

	if (!ContextMenus || !Icons || !Constants) {
		logger.warn(
			'Menu items skipped: Discord moved showContextMenu, ShieldUserIcon or Constants.',
		);

		return;
	}

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
