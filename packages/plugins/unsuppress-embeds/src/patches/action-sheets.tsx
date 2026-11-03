import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isElementNode } from '@unbound-plugins/shared/react/find-element';
import { assets, patcher } from '@unbound-app/api';

import { actionLabel, getEmbedAction, insertionIndex, type Message } from '~/embeds';
import { ICONS, SHEET_ROW_KEY } from '~/constants';
import { getChannelAccess } from '~/access';
import { changeEmbeds } from '~/suppress';
import { ActionSheets } from '~/modules';
import { findTargetRows, rowLabel } from '~/row-groups';

type SheetProps = {
	message?: Message;
};

type OpenSheet = {
	key: string;
	message: Message;
};

/**
 * @description Adds a Suppress Embeds or Unsuppress Embeds row above Delete in the message long-press action sheet.
 * @returns A function that removes the row and ignores sheets still loading.
 */
export function patchActionSheets(): () => void {
	let open: OpenSheet | null = null;

	// UNKNOWN: an action sheet may render any node.
	function addRow(result: unknown) {
		const rows = findTargetRows(result);
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
			insertionIndex(rows.map(rowLabel)),
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

	const unpatch = patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		open = props.message ? { key, message: props.message } : null;

		return open ? addRow : undefined;
	});

	return () => {
		unpatch();
		open = null;
	};
}

export default patchActionSheets;
