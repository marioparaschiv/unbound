import { metro } from '@unbound-app/api';

import { photoUri } from '~/lib/folder-icons';

type PickerResult = {
	assets?: { base64?: string; type?: string; mimeType?: string }[];
	errorCode?: string;
	errorMessage?: string;
};

const ICON_SIDE = 256;

/**
 * @description Opens Discord's photo picker for a folder icon, scaled down so it stays small in settings.
 * @returns The photo as a `data:` URI, or `undefined` when the picker was cancelled.
 * @throws When the picker is unavailable or fails.
 */
export async function pickFolderIcon(): Promise<string | undefined> {
	const ImagePicker = metro.findByProps('launchImageLibraryAsync');

	if (typeof ImagePicker?.launchImageLibraryAsync !== 'function') {
		throw new Error("Discord's photo picker is unavailable.");
	}

	const result: PickerResult = await ImagePicker.launchImageLibraryAsync({
		includeBase64: true,
		mediaType: 'photo',
		selectionLimit: 1,
		maxWidth: ICON_SIDE,
		maxHeight: ICON_SIDE,
	});

	if (result.errorCode) throw new Error(result.errorMessage || result.errorCode);

	const asset = result.assets?.[0];

	return asset?.base64 ? photoUri(asset.base64, asset.mimeType ?? asset.type) : undefined;
}
