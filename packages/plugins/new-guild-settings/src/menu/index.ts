import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { patcher, toasts } from '@unbound-app/api';

import { ActionSheets, ContextMenus, GuildStore, Icons } from '~/menu/modules';
import { addMenuItemOnce, guildSheetId, type GuildSheetProps } from '~/menu/menu-targets';
import { applyNewGuildSettings } from '~/apply';
import { MENU_ROW_KEY } from '~/constants';

type Renderer = ReturnType<typeof createSheetRenderer>;

let open: { key: string; guildId: string } | null = null;
let stopSheets: (() => void) | undefined;
let renderer: Renderer | undefined;

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
 * @returns A function that ignores action sheets that are still loading and unwraps the rendered rows, which the Addon scope can't see.
 */
export function startGuildSheets(): () => void {
	renderer = createSheetRenderer(patcher, (result) => {
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

	const { render } = renderer;

	stopSheets = patchLazySheets<GuildSheetProps>(patcher, ActionSheets, (key, props) => {
		const guildId = guildSheetId(key, props);

		open = guildId ? { key, guildId } : null;

		return guildId ? render : undefined;
	});

	return () => {
		stopSheets?.();
		stopSheets = undefined;
		renderer?.dispose();
		renderer = undefined;
		open = null;
	};
}

/**
 * @description Adds an Apply New Guild Settings item to each server's context menu, the mobile counterpart of Vencord's `guild-header-popout` menu item.
 * Patches `showContextMenu` on the context menu module (`showContextMenu`, `hideContextMenu`) for menus keyed by a server ID in `GuildStore`.
 * The Addon scope removes the patch when the plugin stops.
 * @returns A function with nothing to undo; the Addon scope removes what it added.
 */
export function startGuildContextMenus(): () => void {
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

	return () => {};
}
