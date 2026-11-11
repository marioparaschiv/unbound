import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isElementNode } from '@unbound-plugins/shared/react/find-element';
import type { ActionSheetHost } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { assets, metro, patcher } from '@unbound-app/api';

import { actionLabel, getEmbedAction, type Message } from '~/lib/embeds';
import { findTargetRows, insertionIndex } from '~/lib/row-groups';
import { ICONS, SHEET_ROW_KEY } from '~/lib/constants';
import { getDeleteLabel } from '~/lib/delete-label';
import { getChannelAccess } from '~/lib/access';
import { changeEmbeds } from '~/lib/suppress';

type SheetProps = {
	message?: Message;
};

type OpenSheet = {
	key: string;
	message: Message;
};

let open: OpenSheet | null = null;

// UNKNOWN: an action sheet may render any node.
function addRow(ActionSheets: ActionSheetHost<SheetProps>, result: unknown) {
	const deleteLabel = getDeleteLabel();
	const rows = findTargetRows(result, deleteLabel);
	const current = open;

	if (!current || !Array.isArray(rows)) return result;

	if (rows.some((row) => isElementNode(row) && row.key === SHEET_ROW_KEY)) return result;

	const { key, message } = current;
	const { channel_id: channelId, id: messageId, flags } = message;
	const access = channelId ? getChannelAccess(channelId) : null;
	const action = access ? getEmbedAction(message, access) : null;

	if (!channelId || !messageId || !action) return result;

	const ActionSheetRow = getActionSheetRow();
	const icon = assets.getIdByName(ICONS[action]);

	const onPress = () => {
		ActionSheets.hideActionSheet(key);

		void changeEmbeds(channelId, messageId, flags, action);
	};

	rows.splice(
		insertionIndex(rows, deleteLabel),
		0,
		<ActionSheetRow
			key={SHEET_ROW_KEY}
			label={actionLabel(action)}
			variant={action === 'suppress' ? 'danger' : 'default'}
			icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
			onPress={onPress}
		/>,
	);

	return result;
}

/**
 * @description Adds a Suppress Embeds or Unsuppress Embeds row above Delete in the message long-press action sheet.
 * Patches `openLazy` on Discord's action sheets and each message long-press sheet's render. Reads channels from
 * `ChannelStore`, the viewer from `UserStore`, permissions from `PermissionStore`, and changes flags with `REST`.
 */
export function patchActionSheets(): void {
	const ActionSheets = metro.findByProps('openLazy', 'hideActionSheet');
	const { REST } = metro.common;

	if (!ActionSheets || !REST) {
		logger.warn('Embeds row skipped: Discord moved ActionSheets or REST.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		open = props.message ? { key, message: props.message } : null;

		return open ? (result) => addRow(ActionSheets, result) : undefined;
	});
}

/**
 * @description Forgets the message sheet that was open, so a restart does not add a row for it.
 */
export function forgetOpenSheet(): void {
	open = null;
}
