import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets } from '@unbound-app/api';

import { ActionSheets, Patcher } from '~/modules';
import { copyTranslation } from '~/translate';

type Message = {
	content: string;
};

type SheetProps = {
	message?: Message;
};

/**
 * @description Adds a Translate row to the message long-press action sheet, patching each sheet module as Discord lazy-loads it.
 * @returns A function that removes the row and ignores sheets still loading.
 */
export function patchActionSheets(): () => void {
	let message: Message | undefined;
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addTranslateRow(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (!message?.content.trim() || !Array.isArray(rows)) return result;

		if (rows.some((row) => row?.key === 'unbound-translate')) return result;

		const ActionSheetRow = getActionSheetRow();
		const { content } = message;
		const icon = assets.getIDByName('LanguageIcon');

		function onPress() {
			if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

			void copyTranslation(content);
		}

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-translate'
				label='Translate'
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={onPress}
			/>,
		);

		return result;
	}

	return patchLazySheets<SheetProps>(Patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		if (props.message) message = props.message;

		sheetKey = key;

		return addTranslateRow;
	});
}
