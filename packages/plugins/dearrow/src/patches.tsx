import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets, {
	type SheetRender,
} from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import type { MetroFunction } from '@unbound-app/api/metro';
import { assets, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import {
	canDearrow,
	copyWith,
	dearrowMessage,
	messageVideoIds,
	type Message,
} from '~/lib/message-embeds';
import { activeSession, pendingRows } from '~/lib/session';
import { SHEET_ROW_KEY } from '~/constants';

const CHANGE_TYPE_UPDATE = 1;

type GeneratedRow = {
	changeType?: unknown;
	message?: { id?: unknown } | null;
};

type SheetProps = {
	message?: Message;
};

/**
 * @description Marks the rows of messages whose branding just arrived as changed, so the native chat list binds them again instead of keeping the drawn embed.
 * Patches the `generate` method of `RowManager` once it loads; the patch outlives the session until the original embeds are bound again.
 */
export function patchRowManager(): void {
	if (!activeSession()) return;

	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') return;

		patcher.after(RowManager.prototype, 'generate', ({ result }) => {
			const row = result as GeneratedRow | undefined;
			const id = row?.message?.id;

			if (typeof id === 'string' && pendingRows()?.takeRebind(id))
				row!.changeType = CHANGE_TYPE_UPDATE;
		});
	});
}

/**
 * @description Shows DeArrow titles and thumbnails on YouTube embeds as Discord builds each chat row, and fetches branding for embeds it has not seen.
 * Patches `generateMessageRowData` of the message row data module.
 */
export function patchMessageRows(): void {
	if (!activeSession()) return;

	onMessageRow<RowMessage & Message>({
		feature: 'DeArrow',
		before({ input, message }) {
			const session = activeSession();

			if (!session) return;

			const { lookup, toggles, pending } = session;
			const mode = settings.replaceElements;
			const loading = messageVideoIds(message).filter((id) => lookup.get(id) === undefined);

			if (loading.length) pending.track(loading, message?.channel_id, message?.id);

			const dearrowed = dearrowMessage(message, lookup.get, mode);

			if (!input || !dearrowed || !toggles.isDearrowed(message?.id)) return;

			return { input: copyWith(input, { message: dearrowed }) };
		},
	});
}

/**
 * @description Adds a row to the message long-press action sheet that switches the message's YouTube embeds between dearrowed and original.
 * Patches the sheets Discord opens through `ActionSheets`; the row shows only while `showToggle` is on.
 */
export function patchMessageActionSheets(): void {
	if (!activeSession()) return;

	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Message menu row skipped: Discord moved ActionSheets.');

		return;
	}

	let message: Message | undefined;
	let sheetKey: string | undefined;

	const addToggleRow: SheetRender = (result) => {
		const session = activeSession();

		if (!settings.showToggle || !session) return result;

		const { lookup, toggles, pending } = session;
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

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		message = props.message;
		sheetKey = key;

		return addToggleRow;
	});
}
