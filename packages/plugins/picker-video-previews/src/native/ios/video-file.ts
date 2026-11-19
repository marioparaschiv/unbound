import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const LIBRARY_SCHEME = 'ph://';

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
 * @description Finds the file behind a photo library video, downloading it from iCloud when needed.
 * @param native The plugin's native bridge.
 * @param uri The media picker's `ph://` address, or a `file://` URL, which is returned as is.
 * @returns The video's `file://` URL, or `undefined` when it is not on the device.
 */
export function videoFileIOS(native: NativeBridge, uri: string): Promise<string | undefined> {
	if (uri.startsWith('file://')) return Promise.resolve(uri);

	if (!uri.startsWith(LIBRARY_SCHEME)) return Promise.resolve(undefined);

	const { objc } = native;
	const asset = assetOf(native, uri.slice(LIBRARY_SCHEME.length));
	const Manager = objc.getClass('PHImageManager');

	if (!asset || !Manager) return Promise.resolve(undefined);

	const options = objc.create('PHVideoRequestOptions', 'init', []);

	objc.invoke(options, 'setNetworkAccessAllowed:', [true]);

	return new Promise((resolve) => {
		const done = objc.block(
			{ returnType: 'void', args: ['object', 'object', 'object'] },
			(video: NativeObjectHandle | null) => resolve(fileURLOf(native, video)),
		);

		objc.invoke(
			objc.call(Manager, 'defaultManager') as NativeObjectHandle,
			'requestAVAssetForVideo:options:resultHandler:',
			[asset, options, done],
		);
	});
}

export default videoFileIOS;
