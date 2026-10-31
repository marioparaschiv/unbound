import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { patcher } from '@unbound-app/api';

import { getRawItem, type RawItem, type SheetProps } from '~/raw-items';
import { ActionSheets } from '~/modules';
import RawIcon from '~/components/raw-icon';
import { openRawSheet } from '~/sheets';

type Cleanup = () => void;

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
 * @returns A function that removes the row and every sheet patch.
 */
export function patchActionSheets(state: SheetState): Cleanup {
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
				label='View Raw'
				icon={<RawIcon />}
				onPress={() => {
					ActionSheets.hideActionSheet(open.key);
					openRawSheet(open.item);
				}}
			/>,
		);
	}

	const renderer = createSheetRenderer(patcher, addRow);
	const unpatchSheets = patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (key.startsWith('UserProfile') && typeof props.userId === 'string') {
			state.profileUserId = props.userId;
		}

		const item = getRawItem(key, props);

		state.open = item ? { key, item } : null;

		if (!item) return;

		return renderer.render;
	});

	return () => {
		unpatchSheets();

		renderer.dispose();
	};
}

export default patchActionSheets;
