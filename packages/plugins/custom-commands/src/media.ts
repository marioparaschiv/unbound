import type { TagMedia } from '@custom-commands/tags';
import { fs, metro } from '@unbound-app/api';

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

type PickerAsset = Partial<PickedMedia> & { mimeType?: string };

type PickerResult = {
	assets?: PickerAsset[];
	didCancel?: boolean;
	errorCode?: string;
	errorMessage?: string;
};

type MediaPicker = {
	launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<PickerResult>;
};

export function mediaUri(media: TagMedia): string {
	return `file://${fs.Documents}/${media.storedName}`;
}

function localPath(uri: string): string {
	return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

function resolvePickedMedia(asset: PickerAsset): PickedMedia {
	if (typeof asset.uri !== 'string' || !asset.uri.startsWith('file://'))
		throw new Error('The selected media is unavailable. Choose a local photo or video.');

	const path = localPath(asset.uri);
	const fileName = asset.fileName?.trim() || path.split('/').pop();
	if (!fileName)
		throw new Error('The selected media is unavailable. Choose a local photo or video.');

	const fileSize = asset.fileSize;
	if (!Number.isSafeInteger(fileSize) || fileSize == null || fileSize < 0)
		throw new Error('The media picker did not provide a valid file size.');

	const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];
	const providedType = [asset.mimeType, asset.type].find(
		(value): value is string =>
			typeof value === 'string' && (value.startsWith('image/') || value.startsWith('video/')),
	);
	const type =
		providedType ??
		(
			{
				gif: 'image/gif',
				heic: 'image/heic',
				jpeg: 'image/jpeg',
				jpg: 'image/jpeg',
				m4v: 'video/x-m4v',
				mov: 'video/quicktime',
				mp4: 'video/mp4',
				png: 'image/png',
				webm: 'video/webm',
				webp: 'image/webp',
			} as Record<string, string>
		)[extension?.toLowerCase() ?? ''];
	if (typeof type !== 'string' || (!type.startsWith('image/') && !type.startsWith('video/')))
		throw new Error('Choose an image or video attachment.');

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

export async function pickMedia(): Promise<PickedMedia[]> {
	const picker = metro.findByProps('launchImageLibraryAsync') as MediaPicker | null;
	if (typeof picker?.launchImageLibraryAsync !== 'function')
		throw new Error('The media picker is unavailable on this Discord build.');

	const result = await picker.launchImageLibraryAsync({
		includeBase64: false,
		mediaType: 'mixed',
		selectionLimit: 10,
	});
	if (result.errorCode) throw new Error(result.errorMessage || result.errorCode);
	return (result.assets ?? []).map(resolvePickedMedia);
}

export async function persistMedia(asset: PickedMedia): Promise<TagMedia> {
	const extension =
		asset.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? asset.type.split('/')[1] ?? 'bin';
	const storedName = `custom-commands-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension.toLowerCase()}`;
	const sourcePath = localPath(asset.uri);
	const encoded = await fs.read(sourcePath, 'base64', false);
	await fs.write(storedName, encoded, 'base64');

	return {
		storedName,
		fileName: asset.fileName || storedName,
		mimeType: asset.type,
		fileSize: asset.fileSize,
		width: asset.width,
		height: asset.height,
		duration: asset.duration,
	};
}

export async function removeStoredMedia(media: TagMedia): Promise<void> {
	await fs.rm(media.storedName);
}
