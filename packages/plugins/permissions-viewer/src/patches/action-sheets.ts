import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { messages } from '@unbound-app/i18n';
import { metro, patcher } from '@unbound-app/api';

import { sheetTarget, type SheetProps } from '~/lib/sheet-targets';
import { sheetState as state } from '~/lib/sheet-state';
import { closesProfile } from '~/lib/menu-targets';
import { ROW_ICON, ROW_KEY } from '~/lib/constants';
import { hasPermissionsView } from '~/lib/views';
import { Constants } from '~/lib/modules';
import { openTarget } from '~/lib/sheets';

/**
 * @description Adds a View Permissions row to profile sheets opened from a server, channel long-press sheets and server sheets, the mobile counterparts of Vencord's user, channel and server context menu items.
 * Patches `openLazy` on Discord's action sheets module (`metro.api.ActionSheets`) for `UserProfile*`, `ChannelLongPressActionSheet` and `GuildActionSheet:<id>` sheets, the sheets Discord opens directly through `patchLazySheets`, and the row group each renders.
 * Records the open server profile until `hideActionSheet` closes it, for the profile overflow menu.
 * Reads `GuildStore`, `GuildMemberStore` and `ChannelStore` to show the row only for a server member, a server channel or a server.
 * Records the open sheet, and the open server profile, in the shared sheet state.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets || !Constants) {
		logger.warn('Sheet rows skipped: Discord moved ActionSheets or Constants.');

		return;
	}

	state.open = null;
	state.profile = null;

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
