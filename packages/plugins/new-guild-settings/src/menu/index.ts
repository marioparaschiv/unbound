import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { flux, metro, patcher, toasts } from '@unbound-app/api';

import {
	addMenuItemOnce,
	guildSheetId,
	type GuildSheetProps,
	type MenuItem,
} from '~/menu/menu-targets';
import { MENU_LABEL, MENU_ROW_KEY, PLUGIN_NAME } from '~/constants';
import { applyNewGuildSettings } from '~/apply';

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

const GuildStore = flux.getStore('Guild', { lazy: true });
const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
const Icons = metro.findByProps('SettingsIcon', { lazy: true });

function applyFromMenu(guildId: string): void {
	if (!applyNewGuildSettings(guildId)) return;

	const name = GuildStore.getGuild(guildId)?.name;

	toasts.show({
		title: PLUGIN_NAME,
		content: name ? `Applied to ${name}.` : 'Applied to this server.',
	});
}

function patchGuildSheets(): () => void {
	const { ActionSheets } = metro.api;
	let open: { key: string; guildId: string } | null = null;

	const renderer = createSheetRenderer(patcher, (result) => {
		const current = open;

		if (!current) return;

		insertSheetRows(result, [
			{
				key: MENU_ROW_KEY,
				label: MENU_LABEL,
				icon: 'SettingsIcon',
				onPress: () => {
					ActionSheets.hideActionSheet(current.key);
					applyFromMenu(current.guildId);
				},
			},
		]);
	});

	const unpatchSheets = patchLazySheets<GuildSheetProps>(patcher, ActionSheets, (key, props) => {
		const guildId = guildSheetId(key, props);

		open = guildId ? { key, guildId } : null;

		return guildId ? renderer.render : undefined;
	});

	return () => {
		unpatchSheets();
		renderer.dispose();
		open = null;
	};
}

function patchGuildContextMenus(): () => void {
	return whenLoaded<ContextMenuHost>(ContextMenusFilter, (ContextMenus) =>
		patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
			const guildId = typeof menu?.key === 'string' ? menu.key : undefined;

			if (!menu || !Array.isArray(menu.items) || !guildId || !GuildStore.getGuild(guildId)) {
				return;
			}

			addMenuItemOnce(menu.items, {
				label: MENU_LABEL,
				IconComponent: Icons.SettingsIcon,
				action: () => {
					ContextMenus.hideContextMenu();
					applyFromMenu(guildId);
				},
			});
		}),
	);
}

/**
 * @description Adds an Apply New Guild Settings row to each server's long-press action sheet and context menu, the mobile counterparts of Vencord's `guild-context` and `guild-header-popout` menu items.
 * Patches `openLazy` on Discord's action sheets module (`metro.api.ActionSheets`) for `GuildActionSheet:<id>` sheets and the row group they render,
 * and `showContextMenu` on the context menu module (`showContextMenu`, `hideContextMenu`) for menus keyed by a server ID in `GuildStore`.
 * @returns A function that removes the rows and patches.
 */
export function addApplyMenuItems(): () => void {
	const unpatchSheets = patchGuildSheets();
	const unpatchMenus = patchGuildContextMenus();

	return () => {
		unpatchMenus();
		unpatchSheets();
	};
}

export default addApplyMenuItems;
