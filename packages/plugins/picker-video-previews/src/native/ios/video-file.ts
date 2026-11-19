import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { keptWithin, type KeptVideo } from '~/lib/kept-videos';

const LIBRARY_SCHEME = 'ph://';

let kept: KeptVideo<NativeObjectHandle>[] = [];

function fileBytes({ objc }: NativeBridge, url: string | undefined): number {
	const Files = objc.getClass('NSFileManager');

	if (!url || !Files) return 0;

	const path = decodeURIComponent(url.slice('file://'.length));
	const attributes = objc.call(
		objc.call(Files, 'defaultManager') as NativeObjectHandle,
		'attributesOfItemAtPath:error:',
		path,
		null,
	) as NativeObjectHandle | null;
	const size = attributes ? objc.call(attributes, 'fileSize') : 0;

	return Number(size) || 0;
}

function keep(native: NativeBridge, asset: NativeObjectHandle, url: string | undefined) {
	kept = keptWithin([...kept, { handle: asset, bytes: fileBytes(native, url) }]);
}

function assetOf({ objc }: NativeBridge, identifier: string): NativeObjectHandle | undefined {
	const PHAsset = objc.getClass('PHAsset');
	const NSArray = objc.getClass('NSArray');

	if (!PHAsset || !NSArray) return undefined;

	const result = objc.call(
		PHAsset,
		'fetchAssetsWithLocalIdentifiers:options:',
		objc.call(NSArray, 'arrayWithObject:', identifier),
		null,
	) as NativeObjectHandle | null;

	return (
		(result ? (objc.invoke(result, 'firstObject', []) as NativeObjectHandle | null) : null) ??
		undefined
	);
}

function fileURLOf({ objc }: NativeBridge, asset: NativeObjectHandle | null): string | undefined {
	const URLAsset = objc.getClass('AVURLAsset');

	if (!asset || !URLAsset || !objc.invoke(asset, 'isKindOfClass:', [URLAsset])) return undefined;

	const url = objc.invoke(asset, 'URL', []) as NativeObjectHandle | null;
	const text = url ? String(objc.invoke(url, 'absoluteString', [])) : '';

	return text.startsWith('file://') ? text : undefined;
}

/**
 * @description Finds the file behind a photo library video, downloading it from iCloud when needed and reporting the download's progress. Recent assets stay alive, up to a total file size, since a downloaded video's file lasts only as long as its asset.
 * @param native The plugin's native bridge.
 * @param uri The media picker's `ph://` address, or a `file://` URL, which is returned as is.
 * @param onProgress Receives the iCloud download's progress, from 0 to 1, while it runs.
 * @returns The video's `file://` URL, or `undefined` when it is not on the device.
 */
export function videoFileIOS(
	native: NativeBridge,
	uri: string,
	onProgress?: (fraction: number) => void,
): Promise<string | undefined> {
	if (uri.startsWith('file://')) return Promise.resolve(uri);

	if (!uri.startsWith(LIBRARY_SCHEME)) return Promise.resolve(undefined);

	const { objc } = native;
	const asset = assetOf(native, uri.slice(LIBRARY_SCHEME.length));
	const Manager = objc.getClass('PHImageManager');

	if (!asset || !Manager) return Promise.resolve(undefined);

	const options = objc.create('PHVideoRequestOptions', 'init', []);

	objc.invoke(options, 'setNetworkAccessAllowed:', [true]);

	if (onProgress) {
		const progress = objc.block(
			{ returnType: 'void', args: ['double', 'object', 'pointer', 'object'] },
			(fraction: number) => onProgress(Number(fraction)),
		);

		objc.invoke(options, 'setProgressHandler:', [progress]);
	}

	return new Promise((resolve) => {
		const done = objc.block(
			{ returnType: 'void', args: ['object', 'object', 'object'] },
			(video: NativeObjectHandle | null) => {
				const url = fileURLOf(native, video);

				if (video) keep(native, video, url);

				resolve(url);
			},
		);

		objc.invoke(
			objc.call(Manager, 'defaultManager') as NativeObjectHandle,
			'requestAVAssetForVideo:options:resultHandler:',
			[asset, options, done],
		);
	});
}

export default videoFileIOS;
