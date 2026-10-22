import type { TagMedia } from '@custom-commands/tags';
import { fs, metro } from '@unbound-app/api';
import type { PluginContext } from '@unbound-app/api/native';

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

let pluginContext: PluginContext | null = null;

export function setMediaContext(context: PluginContext | null): void {
	pluginContext = context;
}

export function mediaUri(media: TagMedia): string {
	return `file://${fs.Documents}/${media.storedName}`;
}

function localPath(uri: string): string {
	return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

function resolvePickedMedia(asset: PickerAsset): PickedMedia {
	const context = pluginContext;
	if (!context) throw new Error('Custom Commands is not running.');
	if (typeof asset.uri !== 'string' || !asset.uri.startsWith('file://'))
		throw new Error('The selected media is unavailable. Choose a local photo or video.');

	const path = localPath(asset.uri);
	const fileName = asset.fileName?.trim() || path.split('/').pop();
	if (!fileName)
		throw new Error('The selected media is unavailable. Choose a local photo or video.');

	const objc = context.native.objc;
	const fileManagerClass = objc.getClass('NSFileManager');
	const fileManager = fileManagerClass && objc.call(fileManagerClass, 'defaultManager');
	const attributes =
		fileManager && objc.call(fileManager, 'attributesOfItemAtPath:error:', path, null);
	const file = attributes as Record<string, unknown> | null;
	const fileSize = Number(file?.NSFileSize);
	if (file?.NSFileType !== 'NSFileTypeRegular' || !Number.isSafeInteger(fileSize) || fileSize < 0)
		throw new Error('The selected media is unavailable. Choose a local photo or video.');

	const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];
	const uniformTypeClass = !asset.type && !asset.mimeType && extension && objc.getClass('UTType');
	const uniformType =
		uniformTypeClass && objc.call(uniformTypeClass, 'typeWithFilenameExtension:', extension);
	const inferredType = uniformType && objc.call(uniformType, 'preferredMIMEType');
	const type = asset.type || asset.mimeType || inferredType;
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
	const context = pluginContext;
	if (!context) throw new Error('Custom Commands is not running.');
	const extension =
		asset.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? asset.type.split('/')[1] ?? 'bin';
	const storedName = `custom-commands-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension.toLowerCase()}`;
	const sourcePath = localPath(asset.uri);
	const destinationPath = `${fs.Documents}/${storedName}`;
	let copied = false;

	try {
		const objc = context.native.objc;
		const fileManagerClass = objc.getClass('NSFileManager');
		if (fileManagerClass) {
			const fileManager = objc.call(fileManagerClass, 'defaultManager');
			if (fileManager && typeof fileManager === 'object') {
				copied = Boolean(
					objc.call(
						fileManager,
						'copyItemAtPath:toPath:error:',
						sourcePath,
						destinationPath,
						null,
					),
				);
			}
		}
	} catch {}

	if (!copied) {
		const encoded = await fs.read(sourcePath, 'base64', false);
		await fs.write(storedName, encoded, 'base64');
	}

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
