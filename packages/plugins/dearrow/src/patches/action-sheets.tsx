import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets, {
	type SheetRender,
} from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { assets, patcher } from '@unbound-app/api';

import { ActionSheets, settings } from '~/modules';
import type { PendingRows } from '~/redraw';
import { canDearrow, type Message } from '~/embeds';
import { toReplaceMode } from '~/preferences';
import type { BrandingLookup } from '~/lookup';
import { PLUGIN_NAME, SETTINGS, SHEET_ROW_KEY } from '~/constants';
import type { Toggles } from '~/toggles';

type SheetProps = {
	message?: Message;
};

/**
 * @description Adds a row to the message long-press action sheet that switches the message's YouTube embeds between dearrowed and original.
 * @param lookup The cached DeArrow branding.
 * @param toggles The messages the user switched between dearrowed and original.
 * @param pending The rows waiting for branding, used to bind the switched row again.
 * @returns A function that removes the row and ignores sheets still loading.
 */
export function patchActionSheets(
	lookup: BrandingLookup,
	toggles: Toggles,
	pending: PendingRows,
): () => void {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return () => {};

	let message: Message | undefined;
	let sheetKey: string | undefined;

	const addToggleRow: SheetRender = (result) => {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;
		const messageId = message?.id;
		const channelId = (message as { channel_id?: unknown } | undefined)?.channel_id;
		const mode = toReplaceMode(settings.get('replaceElements', SETTINGS.replaceElements));

		if (typeof messageId !== 'string' || !Array.isArray(rows)) return result;

		if (!canDearrow(message, lookup.get, mode)) return result;

		if (rows.some((row) => isElementNode(row) && row.key === SHEET_ROW_KEY)) return result;

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('ImageIcon');
		const dearrowed = toggles.isDearrowed(messageId);

		function onPress() {
			if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

			toggles.toggle(messageId as string);

			if (typeof channelId === 'string')
				pending.rebindMessage(channelId, messageId as string);
			else pending.rebindAll();
		}

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key={SHEET_ROW_KEY}
				label={dearrowed ? 'Show Original Embed' : 'Dearrow Embed'}
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={onPress}
			/>,
		);

		return result;
	};

	return patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		message = props.message;
		sheetKey = key;

		return addToggleRow;
	});
}
