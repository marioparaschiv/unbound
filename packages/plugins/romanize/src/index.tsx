import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import transliterate from '@unbound-plugins/shared/native/transliterate/transliterate';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import type { PluginContext } from '@unbound-app/api/native';
import { assets, dialogs, metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { romanizeHangul } from '~/lib/revised-romanization';
import { needsRomanizing } from '~/lib/scripts';

type SheetProps = { message?: { content?: string } };

const ROW_KEY = 'unbound-romanize';

async function showRomanized(context: PluginContext, text: string) {
	try {
		const latin =
			(await transliterate(context.native, romanizeHangul(text), 'Any-Latin')) ??
			romanizeHangul(text);

		dialogs.showDialog({
			title: messages.TITLE,
			body: latin,
			buttons: [
				{
					label: messages.COPY,
					onPress: () => {
						metro.common.Clipboard.setString(latin);
						toasts.show({ id: ROW_KEY, title: messages.COPIED });
					},
				},
			],
			cancel: messages.CLOSE,
		});
	} catch (error) {
		logger.error('Failed to romanize a message:', error);
		toasts.show({ id: ROW_KEY, title: messages.FAILED });
	}
}

export function start(context: PluginContext) {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Romanize skipped: Discord moved ActionSheets.');

		return;
	}

	let text = '';
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addRow(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (!text || !Array.isArray(rows) || rows.some((row) => row?.key === ROW_KEY))
			return result;

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('LanguageIcon');
		const shown = text;

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key={ROW_KEY}
				label={messages.ROW}
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={() => {
					if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

					void showRomanized(context, shown);
				}}
			/>,
		);

		return result;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		const content = props.message?.content ?? '';

		text = needsRomanizing(content) ? content : '';
		sheetKey = key;

		return addRow;
	});
}

export function stop() {}
