import { MIME_TYPES } from '~/constants';

export type PickedMedia = {
	duration?: number;
	fileName: string;
	fileSize: number;
	height?: number;
	id?: string;
	type: string;
	uri: string;
	width?: number;
};

export type PickerAsset = Partial<PickedMedia> & { mimeType?: string };

function isMediaType(type: string | undefined): type is string {
	return Boolean(type?.startsWith('image/') || type?.startsWith('video/'));
}

/**
 * @description Gets a file name's extension.
 * @param fileName The file name.
 * @returns The extension without its dot, or `undefined` when there is none.
 */
export function fileExtension(fileName: string): string | undefined {
	return fileName.match(/\.([a-z0-9]+)$/i)?.[1];
}

/**
 * @description Turns a `file://` URI into a file system path.
 * @param uri The URI, or a path that is returned unchanged.
 * @returns The decoded path.
 */
export function localPath(uri: string): string {
	return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

/**
 * @description Checks an asset from Discord's media picker and fills in its name and MIME type.
 * @param asset One asset from the picker's result.
 * @returns The asset's metadata.
 * @throws When the asset is not a local file, has no file size, or is not an image or video.
 */
export function resolvePickedMedia(asset: PickerAsset): PickedMedia {
	if (!asset.uri?.startsWith('file://')) {
		throw new Error('The selected media is unavailable. Choose a local photo or video.');
	}

	const fileName = asset.fileName?.trim() || localPath(asset.uri).split('/').pop();

	if (!fileName) {
		throw new Error('The selected media is unavailable. Choose a local photo or video.');
	}

	const { fileSize } = asset;

	if (fileSize === undefined || !Number.isSafeInteger(fileSize) || fileSize < 0) {
		throw new Error('The media picker did not provide a valid file size.');
	}

	const type =
		[asset.mimeType, asset.type].find(isMediaType) ??
		MIME_TYPES[fileExtension(fileName)?.toLowerCase() ?? ''];

	if (!type) {
		throw new Error('Choose an image or video attachment.');
	}

	return {
		id: asset.id,
		uri: asset.uri,
		type,
		fileName,
		fileSize,
		width: asset.width,
		height: asset.height,
		duration: asset.duration,
	};
}

export default { fileExtension, localPath, resolvePickedMedia };
