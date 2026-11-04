import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { SHEET_ROW_KEY, UPLOAD_PREVIEW_SHEET } from '~/constants';
import AnonymiseRow from '~/components/anonymise-row';
import { findSheetRows, insertRowOnce } from '~/sheet-rows';
import type { Upload, UploadChoices } from '~/uploads';
import { skip } from '~/skip';

type SheetProps = {
	upload?: Upload;
};

/**
 * @description Adds an anonymise switch to the sheet Discord opens for a file waiting in the chat input.
 * @param choices The per-upload anonymise choices.
 * @returns A function that stops waiting for the sheet and removes the patch.
 */
export function patchUploadPreviewSheet(choices: UploadChoices): () => void {
	return whenLoaded<AnyProps>(UPLOAD_PREVIEW_SHEET, (module) => {
		const target = findRenderTarget(module);

		if (!target) {
			skip('the upload sheet switch, UploadPreviewActionSheet has no render function');

			return;
		}

		return patcher.after(target.holder, target.key, ({ args: [props], result }) => {
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
	});
}

export default patchUploadPreviewSheet;
