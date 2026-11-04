import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { getRawItem, type RawItem, type SheetProps } from '~/raw/raw-items';
import RawIcon from '~/raw/components/raw-icon';
import { ActionSheets } from '~/raw/modules';
import { openRawSheet } from '~/raw/sheets';

type OpenSheet = {
	key: string;
	item: RawItem;
};

/** What the action sheet patch last saw, read by the context menu patch. */
export type SheetState = {
	open: OpenSheet | null;
	profileUserId: string | null;
};

/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets.
 * @param state Where the patch records the open sheet for the context menu patch.
 */
export function patchActionSheets(state: SheetState): void {
	// UNKNOWN: an action sheet may render any node.
	function addRow(result: unknown) {
		const { open } = state;

		if (!open) return;

		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (
			!Array.isArray(rows) ||
			rows.some((row) => isElementNode(row) && row.key === 'unbound-view-raw')
		) {
			return;
		}

		const ActionSheetRow = getActionSheetRow();

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-view-raw'
				label={messages.VIEW_RAW}
				icon={<RawIcon />}
				onPress={() => {
					ActionSheets.hideActionSheet(open.key);
					openRawSheet(open.item);
				}}
			/>,
		);
	}

	const renderer = createSheetRenderer(patcher, addRow);
	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (key.startsWith('UserProfile') && typeof props.userId === 'string') {
			state.profileUserId = props.userId;
		}

		const item = getRawItem(key, props);

		state.open = item ? { key, item } : null;

		if (!item) return;

		return renderer.render;
	});
}

export default patchActionSheets;
