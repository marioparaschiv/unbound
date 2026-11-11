import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher, utils } from '@unbound-app/api';

import { holdsRows, insertRowOnce } from '~/lib/sheet-rows';
import AnonymiseRow from '~/components/anonymise-row';
import type { Upload } from '~/lib/uploads';
import { uploadChoices } from '~/lib/choices';
import { SHEET_ROW_KEY, UPLOAD_PREVIEW_SHEET } from '~/lib/constants';

type SheetProps = {
	upload?: Upload;
};

type SendOptions = {
	attachmentsToUpload?: unknown;
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
 * @description Renames each file as Discord starts uploading it, so the name Discord's upload service receives is already anonymous.
 * Patches `CloudUpload.prototype.upload` once its module loads.
 */
export function patchCloudUpload(): void {
	metro.onModuleLoaded(metro.filters.byProps('CloudUpload'), (module: AnyProps) => {
		const prototype = module.CloudUpload?.prototype;

		if (typeof prototype?.upload !== 'function') {
			logger.warn('Renaming uploads skipped: CloudUpload has no upload method.');

			return;
		}

		patcher.before(prototype, 'upload', ({ this: upload }) => {
			uploadChoices().apply(upload);
		});
	});
}

/**
 * @description Applies each attachment's anonymise choice as the message is sent, which covers files Discord uploaded before the choice was changed.
 * Patches `Messages._sendMessage`.
 */
export function patchSendMessage(): void {
	const Messages = metro.api.Messages;

	if (typeof Messages?._sendMessage !== 'function') {
		logger.warn('Renaming at send skipped: Messages has no _sendMessage method.');

		return;
	}

	patcher.before(Messages, '_sendMessage', ({ args }) => {
		const attachments = (args[2] as SendOptions | undefined)?.attachmentsToUpload;

		if (!Array.isArray(attachments)) return;

		for (const upload of attachments as Upload[]) uploadChoices().apply(upload);
	});
}

/**
 * @description Adds an anonymise switch to the sheet Discord opens for a file waiting in the chat input.
 * Renders a row into `UploadPreviewActionSheet`.
 */
export function patchUploadPreviewSheet(): void {
	const UploadPreviewSheet = metro.findByFilePath(UPLOAD_PREVIEW_SHEET);

	if (!UploadPreviewSheet) {
		logger.warn('Upload preview switch skipped: Discord moved UploadPreviewSheet.');

		return;
	}

	patcher.react.after(UploadPreviewSheet, 'default', ({ props, result }) => {
		const upload = (props as SheetProps | undefined)?.upload;
		const rows = upload ? findSheetRows(result) : undefined;

		if (!upload || !rows) return result;

		insertRowOnce(
			rows,
			<AnonymiseRow key={SHEET_ROW_KEY} upload={upload} choices={uploadChoices()} />,
			SHEET_ROW_KEY,
		);

		return result;
	});
}
