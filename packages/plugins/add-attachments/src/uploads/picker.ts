import { ImagePicker } from '~/discord/modules';
import type { UploadItem } from '~/types';

type PickerAsset = {
	uri?: string;
	fileName?: string;
	type?: string;
	mimeType?: string;
	width?: number;
	height?: number;
	duration?: number;
};

type PickerResult = {
	assets?: PickerAsset[];
	didCancel?: boolean;
	errorCode?: string;
	errorMessage?: string;
};

function toUploadItem(asset: PickerAsset): UploadItem | null {
	const { uri } = asset;

	if (!uri) return null;

	return {
		id: uri,
		origin: 1,
		uri,
		originalUri: uri,
		mimeType: asset.mimeType ?? asset.type ?? 'application/octet-stream',
		filename: asset.fileName?.trim() || uri.split('/').pop() || 'attachment',
		width: asset.width,
		height: asset.height,
		playableDuration: asset.duration ?? null,
		platform: 0,
		createdUsingInAppCamera: false,
	};
}

/**
 * @description Opens Discord's photo and video picker.
 * @param limit The most files to let the user choose.
 * @returns The chosen files, empty when the picker was cancelled.
 * @throws When the picker is unavailable or fails.
 */
export async function pickAttachments(limit: number): Promise<UploadItem[]> {
	if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
		throw new Error('The media picker is unavailable on this Discord build.');
	}

	const result: PickerResult = await ImagePicker.launchImageLibraryAsync({
		includeBase64: false,
		mediaType: 'mixed',
		selectionLimit: limit,
	});

	if (result.errorCode) throw new Error(result.errorMessage || result.errorCode);

	return (result.assets ?? [])
		.map(toUploadItem)
		.filter((item): item is UploadItem => item !== null);
}

export default pickAttachments;
