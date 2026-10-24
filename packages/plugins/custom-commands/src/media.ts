import { fs } from '@unbound-app/api';

import { fileExtension, localPath, resolvePickedMedia } from '~/picked-media';
import type { PickedMedia, PickerAsset } from '~/picked-media';
import { MAX_ATTACHMENTS } from '~/constants';
import type { TagMedia } from '~/tags';
import { ImagePicker } from '~/modules';

/** An attachment in the command form: already saved, or just picked and not yet copied. */
export type DraftMedia = PickedMedia | TagMedia;

type PickerResult = {
	assets?: PickerAsset[];
	errorCode?: string;
	errorMessage?: string;
};

/**
 * @description Checks whether a form attachment is already saved in the plugin's documents.
 * @param media The attachment.
 * @returns `true` for a saved attachment.
 */
export function isSaved(media: DraftMedia): media is TagMedia {
	return 'storedName' in media;
}

/**
 * @description Builds the `file://` URI of a saved attachment.
 * @param media The saved attachment.
 * @returns The attachment's URI in the app's documents directory.
 */
export function mediaUri(media: TagMedia): string {
	return `file://${fs.Documents}/${media.storedName}`;
}

/**
 * @description Opens Discord's photo library picker.
 * @returns The picked images and videos.
 * @throws When the picker is unavailable, fails, or returns an unusable asset.
 */
export async function pickMedia(): Promise<PickedMedia[]> {
	if (!ImagePicker.launchImageLibraryAsync) {
		throw new Error('The media picker is unavailable on this Discord build.');
	}

	const result: PickerResult = await ImagePicker.launchImageLibraryAsync({
		includeBase64: false,
		mediaType: 'mixed',
		selectionLimit: MAX_ATTACHMENTS,
	});

	if (result.errorCode) {
		throw new Error(result.errorMessage || result.errorCode);
	}

	return (result.assets ?? []).map(resolvePickedMedia);
}

/**
 * @description Copies a picked file into the plugin's documents so the command keeps working after the picker's copy is gone.
 * @param media The picked file.
 * @returns The saved attachment.
 */
export async function persistMedia(media: PickedMedia): Promise<TagMedia> {
	const extension = fileExtension(media.fileName) ?? media.type.split('/')[1] ?? 'bin';
	const id = Math.random().toString(36).slice(2, 10);
	const storedName = `custom-commands-${Date.now()}-${id}.${extension.toLowerCase()}`;

	await fs.write(storedName, await fs.read(localPath(media.uri), 'base64', false), 'base64');

	return {
		storedName,
		fileName: media.fileName || storedName,
		mimeType: media.type,
		fileSize: media.fileSize,
		width: media.width,
		height: media.height,
		duration: media.duration,
	};
}

/**
 * @description Deletes a saved attachment's file.
 * @param media The saved attachment.
 * @returns A promise that settles once the file is gone.
 */
export async function removeStoredMedia(media: TagMedia): Promise<void> {
	await fs.rm(media.storedName);
}

export default { isSaved, mediaUri, pickMedia, persistMedia, removeStoredMedia };
