import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { getRawItem, type SheetProps } from '~/lib/raw-items';
import RawIcon from '~/components/raw-icon';
import { ActionSheets } from '~/lib/modules';
import { openRawSheet } from '~/lib/sheets';
import { sheetState } from '~/lib/sheet-state';

/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets.
 * Patches `openLazy` on Discord's action sheet module and the long-press sheets it opens without it, and records the open sheet in `sheetState`.
 */
export function patchActionSheets(): void {
	if (!ActionSheets) {
		logger.warn('View Raw rows skipped: Discord moved ActionSheets.');

		return;
	}

	// UNKNOWN: an action sheet may render any node.
	function addRow(result: unknown) {
		const { open } = sheetState;

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
			sheetState.profileUserId = props.userId;
		}

		const item = getRawItem(key, props);

		sheetState.open = item ? { key, item } : null;

		if (!item) return;

		return renderer.render;
	});
}
