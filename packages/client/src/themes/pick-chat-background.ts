import { documentsPath, readFile, removeFile, writeFile } from '~/native/fs';
import { findByProps } from '~/metro/lookups';

type PickerAsset = { uri?: string; fileName?: string };

type PickerResult = {
	assets?: PickerAsset[];
	errorCode?: string;
	errorMessage?: string;
};

type PickerOptions = {
	includeBase64: boolean;
	mediaType: 'photo';
	selectionLimit: number;
	maxWidth: number;
	maxHeight: number;
};

type ImagePickerModule = {
	launchImageLibraryAsync?: (options: PickerOptions) => Promise<PickerResult>;
};

/** Discord's photo library picker, the one its attachment button opens. */
const ImagePicker: ImagePickerModule | undefined = findByProps('launchImageLibraryAsync');

/** Picked photos are copied here, inside the Unbound folder, so they outlive the picker's temporary copy. */
const SAVED_PREFIX = 'Unbound/chat-background-';
/** Large enough for any phone screen; the picker scales a bigger photo down before it is copied. */
const MAX_SIDE = 2560;

function localPath(uri: string) {
	return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

/**
 * @description Reports whether a chat background URL names a photo picked with {@link pickChatBackground}.
 * @param url The saved chat background URL.
 * @returns Whether it is a picked photo.
 */
export function isPickedChatBackground(url: string): boolean {
	return url.startsWith(`file://${documentsPath}/${SAVED_PREFIX}`);
}

/**
 * @description Opens Discord's photo picker and copies the chosen photo into the Unbound folder, replacing the photo
 * picked before. Each pick gets a new name, so React Native's image cache never shows the old one.
 * @param previous The chat background URL saved now.
 * @returns The copied photo's `file://` URL, or `undefined` when the picker was cancelled.
 * @throws When the picker is unavailable or fails.
 */
export async function pickChatBackground(previous: string): Promise<string | undefined> {
	if (typeof ImagePicker?.launchImageLibraryAsync !== 'function') {
		throw new Error("Discord's photo picker is unavailable.");
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		includeBase64: false,
		mediaType: 'photo',
		selectionLimit: 1,
		maxWidth: MAX_SIDE,
		maxHeight: MAX_SIDE,
	});

	if (result.errorCode) {
		throw new Error(result.errorMessage || result.errorCode);
	}

	const uri = result.assets?.[0]?.uri;

	if (!uri) return;

	const extension = localPath(uri).split('.').pop()?.toLowerCase() || 'jpg';
	const path = `${SAVED_PREFIX}${Date.now()}.${extension}`;

	await writeFile(path, await readFile(localPath(uri), 'base64', false), 'base64');

	if (isPickedChatBackground(previous)) {
		await removeFile(previous.slice(`file://${documentsPath}/`.length));
	}

	return `file://${documentsPath}/${path}`;
}
