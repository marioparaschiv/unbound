import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets, {
	type SheetRender,
} from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { assets, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { canDearrow, type Message } from '~/embeds/message-embeds';
import type { PendingRows } from '~/embeds/redraw';
import type { BrandingLookup } from '~/embeds/lookup';
import type { Toggles } from '~/embeds/toggles';
import { ActionSheets } from '~/embeds/modules';
import { PLUGIN_NAME, SHEET_ROW_KEY } from '~/constants';

type SheetProps = {
	message?: Message;
};

/**
 * @description Adds a row to the message long-press action sheet that switches the message's YouTube embeds between dearrowed and original.
 * The row shows only while `showToggle` is on. `stop` calls the returned function, because the scope cannot see a sheet that is still loading when the plugin stops.
 * @param lookup The cached DeArrow branding.
 * @param toggles The messages the user switched between dearrowed and original.
 * @param pending The rows waiting for branding, used to bind the switched row again.
 * @returns A function that removes the row and ignores sheets still loading.
 */
export function patchToggleRow(
	lookup: BrandingLookup,
	toggles: Toggles,
	pending: PendingRows,
): () => void {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets })) return () => {};

	let message: Message | undefined;
	let sheetKey: string | undefined;

	const addToggleRow: SheetRender = (result) => {
		if (!settings.showToggle) return result;

		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;
		const messageId = message?.id;
		const channelId = (message as { channel_id?: unknown } | undefined)?.channel_id;
		const mode = settings.replaceElements;

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
				label={dearrowed ? messages.SHOW_ORIGINAL_EMBED : messages.DEARROW_EMBED}
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
