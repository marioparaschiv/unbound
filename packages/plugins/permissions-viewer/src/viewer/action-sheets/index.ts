import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { sheetTarget, type SheetProps, type Target } from '~/viewer/action-sheets/targets';
import { closesProfile, type ProfileRecord } from '~/viewer/context-menus/targets';
import { ROW_ICON, ROW_KEY } from '~/constants';
import { hasPermissionsView } from '~/viewer/permissions/views';
import { ActionSheets } from '~/viewer/modules';
import { openTarget } from '~/viewer/sheets';

export type SheetState = {
	open: { key: string; target: Target } | null;
	profile: ProfileRecord | null;
};

/**
 * @description Adds a View Permissions row to profile sheets opened from a server, channel long-press sheets and server sheets, the mobile counterparts of Vencord's user, channel and server context menu items.
 * Patches `openLazy` on Discord's action sheets module (`metro.api.ActionSheets`) for `UserProfile*`, `ChannelLongPressActionSheet` and `GuildActionSheet:<id>` sheets, the sheets Discord opens directly through `patchLazySheets`, and the row group each renders.
 * Records the open server profile until `hideActionSheet` closes it, for the profile overflow menu.
 * Reads `GuildStore`, `GuildMemberStore` and `ChannelStore` to show the row only for a server member, a server channel or a server.
 * @param state Where the patch records the open sheet, and the open server profile for the profile overflow menu.
 */
export function patchActionSheets(state: SheetState): void {
	const renderer = createSheetRenderer(patcher, (result) => {
		const { open } = state;

		if (!open) return;

		insertSheetRows(result, [
			{
				key: ROW_KEY,
				label: messages.VIEW_PERMISSIONS,
				icon: ROW_ICON,
				onPress: () => {
					ActionSheets.hideActionSheet(open.key);
					openTarget(open.target);
				},
			},
		]);
	});

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const target = sheetTarget(key, props);

		if (/^UserProfile/i.test(key)) {
			state.profile =
				target?.kind === 'member'
					? { key, guildId: target.guildId, userId: target.userId }
					: null;
		}

		state.open = target && hasPermissionsView(target) ? { key, target } : null;

		return state.open ? renderer.render : undefined;
	});

	patcher.before(ActionSheets, 'hideActionSheet', ({ args: [key] }) => {
		if (closesProfile(state.profile, key)) state.profile = null;
	});
}
