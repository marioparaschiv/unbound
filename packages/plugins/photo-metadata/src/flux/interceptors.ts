import { dialogs, flux, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { decide, hasMetadata, isPhoto, type UploadFile } from '~/lib/metadata';
import { describeReports, type PhotoReport } from '~/lib/report';
import type { PhotoTools } from '~/native/photos';

type AddFilesAction = { type: string; files?: UploadFile[]; unboundPhotoMetadata?: boolean };

async function cleanFile(
	tools: PhotoTools,
	file: UploadFile,
	folder: string,
): Promise<{ file: UploadFile; report?: PhotoReport }> {
	const metadata = await tools.inspect(file);
	const filename = file.filename ?? 'photo';

	if (!hasMetadata(metadata)) return { file };

	const decision = decide(metadata, {
		removeLocation: settings.removeLocation,
		removeAll: settings.removeAll,
	});

	if (decision !== 'strip') {
		return {
			file,
			report: decision === 'warn' ? { filename, metadata, removed: false } : undefined,
		};
	}

	const cleaned = await tools.strip(file, metadata, folder).catch((error: unknown) => {
		logger.error(`Failed to remove the metadata of ${filename}:`, error);

		return undefined;
	});

	if (!cleaned) {
		toasts.warning('STRIP_FAILED', { name: filename });

		return { file, report: { filename, metadata, removed: false } };
	}

	return {
		file: {
			...file,
			uri: cleaned.uri,
			originalUri: cleaned.uri,
			filename: cleaned.filename,
			mimeType: cleaned.mimeType,
		},
		report: { filename, metadata, removed: true },
	};
}

// Only photos attached with their metadata are announced; a removal happens silently.
function announce(reports: PhotoReport[]) {
	toasts.show({
		content: format('LOCATED', { count: reports.length }),
		icon: 'ImageIcon',
		buttons: [
			{
				content: messages.DETAILS,
				onPress: () =>
					dialogs.showDialog({
						title: messages.DETAILS_TITLE,
						body: describeReports(reports),
						cancel: true,
					}),
			},
		],
	});
}

async function cleanAction(tools: PhotoTools, action: AddFilesAction, folder: string) {
	const reports: PhotoReport[] = [];
	const files: UploadFile[] = [];

	for (const file of action.files ?? []) {
		if (!isPhoto(file)) {
			files.push(file);
			continue;
		}

		const result = await cleanFile(tools, file, folder).catch((error: unknown) => {
			logger.error(`Failed to check the metadata of ${file.filename ?? file.uri}:`, error);

			return { file, report: undefined };
		});

		files.push(result.file);

		if (result.report) reports.push(result.report);
	}

	void flux.dispatch({ ...action, files, unboundPhotoMetadata: true } as never);

	const kept = reports.filter((report) => !report.removed);

	if (kept.length) announce(kept);
}

/**
 * @description Checks the photos Discord is about to attach: holds back `UPLOAD_ATTACHMENT_ADD_FILES`, reads each
 * photo's metadata, removes it where the settings say, then dispatches the action again with the cleaned files.
 * @param tools The platform's metadata reader and remover.
 * @param folder The plugin's temporary folder, where cleaned copies go.
 */
export function interceptAttachments(tools: PhotoTools, folder: string): void {
	flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (action) => {
		const added = action as unknown as AddFilesAction;

		if (added.unboundPhotoMetadata || !(added.files ?? []).some(isPhoto)) return;

		void cleanAction(tools, added, folder);

		return true;
	});
}

export default { interceptAttachments };
