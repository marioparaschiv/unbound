import type { NativeBridge } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { dialogs, flux, fs, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { convertedFile, libraryIdentifier, type SendAs, type UploadFile } from '~/lib/files';
import { isLivePhoto, videoToGif, writePairedVideo } from '~/native/ios/live-photo';

type AddFilesAction = {
	type: string;
	files?: UploadFile[];
	livePhotoSenderHandled?: boolean;
};

const GIF = { maxSide: 480, fps: 10, maxSeconds: 4 };

let nextFolder = 0;

async function convert(
	native: NativeBridge,
	folder: string,
	file: UploadFile,
	sendAs: SendAs,
): Promise<UploadFile> {
	const identifier = libraryIdentifier(file);

	if (sendAs === 'still' || !identifier) return file;

	const directory = `${folder}/${Date.now()}-${nextFolder++}`;
	const absolute = `${fs.documentsPath}/${directory}`;
	const videoPath = `${absolute}/live.mov`;

	await fs.writeFile(`${directory}/.keep`, '');

	if (!(await writePairedVideo(native, identifier, videoPath)))
		throw new Error('no paired video');
	if (sendAs === 'video') return convertedFile(file, 'video', videoPath);

	const gifPath = `${absolute}/live.gif`;
	const size = videoToGif(native, videoPath, gifPath, GIF);

	if (!size) throw new Error('the GIF could not be written');

	return convertedFile(file, 'gif', gifPath, size);
}

async function sendLivePhotos(
	native: NativeBridge,
	folder: string,
	action: AddFilesAction,
	live: Set<UploadFile>,
	sendAs: SendAs,
) {
	const working = sendAs === 'still' ? undefined : toasts.info('CONVERTING', { duration: 0 });
	const files = await Promise.all(
		(action.files ?? []).map(async (file) => {
			if (!live.has(file)) return file;

			try {
				return await convert(native, folder, file, sendAs);
			} catch (error) {
				logger.error(`Failed to convert Live Photo ${file.uri}:`, error);
				toasts.warning('CONVERT_FAILED');

				return file;
			}
		}),
	);

	working?.close();
	void flux.dispatch({ ...action, files, livePhotoSenderHandled: true });
}

function askSendAs(count: number): Promise<SendAs | undefined> {
	return new Promise((resolve) => {
		const choice = (sendAs: SendAs, label: string) => ({
			label,
			variant: 'secondary' as const,
			onPress: () => resolve(sendAs),
		});

		dialogs.showDialog({
			title: count > 1 ? format('DIALOG_TITLE_MANY', { count }) : messages.DIALOG_TITLE,
			buttons: [
				choice('still', messages.STILL),
				choice('video', messages.VIDEO),
				choice('gif', messages.GIF),
			],
			cancel: true,
			onCancel: () => resolve(undefined),
		});
	});
}

/**
 * @description Catches Live Photos picked for upload and attaches each as its still image, its video or a GIF, asking
 * when the setting says so. The upload is held while it converts, then added again with the converted files.
 * @param native The plugin's native bridge.
 * @param folder The plugin's temporary folder, relative to the documents directory.
 */
export function interceptLivePhotos(native: NativeBridge, folder: string): void {
	flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (raw) => {
		const action = raw as AddFilesAction;

		if (action.livePhotoSenderHandled || settings.sendAs === 'still') return false;

		const live = new Set(
			(action.files ?? []).filter((file) => {
				const identifier = libraryIdentifier(file);

				return identifier !== undefined && isLivePhoto(native, identifier);
			}),
		);

		if (!live.size) return false;

		void (async () => {
			const sendAs =
				settings.sendAs === 'ask'
					? await askSendAs(live.size)
					: (settings.sendAs as SendAs);

			if (sendAs) await sendLivePhotos(native, folder, action, live, sendAs);
		})();

		return true;
	});
}

export default { interceptLivePhotos };
