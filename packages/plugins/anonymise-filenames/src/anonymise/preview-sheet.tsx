import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { patcher, utils } from '@unbound-app/api';

import { holdsRows, insertRowOnce } from '~/anonymise/sheet-rows';
import AnonymiseRow from '~/anonymise/components/anonymise-row';
import type { Upload, UploadChoices } from '~/anonymise/uploads';
import { UploadPreviewSheet } from '~/anonymise/modules';
import { SHEET_ROW_KEY } from '~/constants';

type SheetProps = {
	upload?: Upload;
};

// The sheet's row group, or else the first element whose children include pressable or switchable rows.
function findSheetRows(result: unknown): unknown[] | undefined {
	const group =
		utils.react.findComponent(result, isActionSheetRowGroup) ??
		utils.react.findComponent(result, holdsRows);
	const rows = group?.props?.children;

	return Array.isArray(rows) ? rows : undefined;
}

/**
 * @description Adds an anonymise switch to the sheet Discord opens for a file waiting in the chat input.
 * @param choices The per-upload anonymise choices.
 */
export function patchUploadPreviewSheet(choices: UploadChoices): void {
	patcher.react.after(UploadPreviewSheet, 'default', ({ props, result }) => {
		const upload = (props as SheetProps | undefined)?.upload;
		const rows = upload ? findSheetRows(result) : undefined;

		if (!upload || !rows) return result;

		insertRowOnce(
			rows,
			<AnonymiseRow key={SHEET_ROW_KEY} upload={upload} choices={choices} />,
			SHEET_ROW_KEY,
		);

		return result;
	});
}
