import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { flux, metro, patcher, toasts } from '@unbound-app/api';

import {
	addMenuItemOnce,
	guildSheetId,
	type GuildSheetProps,
	type MenuItem,
} from '~/lib/menu-targets';
import { applyNewGuildSettings } from '~/lib/apply';
import { NotificationSettings } from '~/lib/modules';
import { MENU_ROW_KEY } from '~/lib/constants';

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

const GuildStore = flux.getStore('Guild');

let open: { key: string; guildId: string } | null = null;

function applyFromMenu(guildId: string): void {
	if (!applyNewGuildSettings(guildId)) return;

	const name = GuildStore.getGuild(guildId)?.name;

	toasts.show({
		title: addon.name,
		content: name ? format('APPLIED_TO_GUILD', { name }) : messages.APPLIED_TO_THIS_SERVER,
	});
}

/**
 * @description Adds an Apply New Guild Settings row to each server's long-press action sheet, the mobile counterpart of Vencord's `guild-context` menu item.
 * Patches `openLazy` on Discord's action sheets module (`metro.api.ActionSheets`) for `GuildActionSheet:<id>` sheets and the row group they render.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!NotificationSettings || !ActionSheets) {
		logger.warn(
			'Action sheet row skipped: Discord moved updateGuildNotificationSettings or ActionSheets.',
		);

		return;
	}

	open = null;

	const { render } = createSheetRenderer(patcher, (result) => {
		const current = open;

		if (!current) return;

		insertSheetRows(result, [
			{
				key: MENU_ROW_KEY,
				label: messages.APPLY_NEW_GUILD_SETTINGS,
				icon: 'SettingsIcon',
				onPress: () => {
					ActionSheets.hideActionSheet(current.key);
					applyFromMenu(current.guildId);
				},
			},
		]);
	});

	patchLazySheets<GuildSheetProps>(patcher, ActionSheets, (key, props) => {
		const guildId = guildSheetId(key, props);

		open = guildId ? { key, guildId } : null;

		return guildId ? render : undefined;
	});
}

/**
 * @description Adds an Apply New Guild Settings item to each server's context menu, the mobile counterpart of Vencord's `guild-header-popout` menu item.
 * Patches `showContextMenu` on the context menu module (`showContextMenu`, `hideContextMenu`) for menus keyed by a server ID in `GuildStore`.
 */
export function patchContextMenus(): void {
	const ContextMenus: ContextMenuHost | undefined = metro.findByProps(
		'showContextMenu',
		'hideContextMenu',
	);
	const Icons = metro.findByProps('SettingsIcon');

	if (!NotificationSettings || !ContextMenus || !Icons) {
		logger.warn(
			'Context menu item skipped: Discord moved updateGuildNotificationSettings, showContextMenu or SettingsIcon.',
		);

		return;
	}

	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		const guildId = typeof menu?.key === 'string' ? menu.key : undefined;

		if (!menu || !Array.isArray(menu.items) || !guildId || !GuildStore.getGuild(guildId)) {
			return;
		}

		addMenuItemOnce(menu.items, {
			label: messages.APPLY_NEW_GUILD_SETTINGS,
			IconComponent: Icons.SettingsIcon,
			action: () => {
				ContextMenus.hideContextMenu();
				applyFromMenu(guildId);
			},
		});
	});
}
