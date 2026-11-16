import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import {
	asJpegName,
	locationOf,
	signedCoordinate,
	type PhotoMetadata,
	type UploadFile,
} from '~/lib/metadata';
import type { PhotoTools } from '~/native/photos';

type ObjC = NativeBridge['objc'];

type GpsPart = {
	Latitude?: number;
	LatitudeRef?: string;
	Longitude?: number;
	LongitudeRef?: string;
};

type TiffPart = { Make?: string; Model?: string; Software?: string; DateTime?: string };

type ExifPart = { DateTimeOriginal?: string };

const PHOTOS_SCHEME = 'ph://';
const REQUEST_TIMEOUT_MS = 15000;

function photosAssetURL(objc: ObjC, identifier: string): Promise<NativeObjectHandle | null> {
	const PHAsset = objc.getClass('PHAsset');
	const Options = objc.getClass('PHContentEditingInputRequestOptions');

	if (!PHAsset || !Options) return Promise.resolve(null);

	const assets = objc.call(
		PHAsset,
		'fetchAssetsWithLocalIdentifiers:options:',
		[identifier],
		null,
	) as NativeObjectHandle;
	const asset = objc.invoke(assets, 'firstObject', []) as NativeObjectHandle | null;

	if (!asset) return Promise.resolve(null);

	const options = objc.call(Options, 'new') as NativeObjectHandle;

	objc.invoke(options, 'setNetworkAccessAllowed:', [true]);

	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS);
		const block = objc.block({ returnType: 'void', args: ['object', 'object'] }, ((
			input: NativeObjectHandle | null,
		) => {
			clearTimeout(timer);
			resolve(
				input
					? (objc.invoke(input, 'fullSizeImageURL', []) as NativeObjectHandle | null)
					: null,
			);
		}) as never);

		void objc.invokeAsync(asset, 'requestContentEditingInputWithOptions:completionHandler:', [
			options,
			block,
		]);
	});
}

async function fileURL(objc: ObjC, file: UploadFile): Promise<NativeObjectHandle | null> {
	const NSURL = objc.getClass('NSURL');

	if (!NSURL) return null;

	if (file.uri.startsWith(PHOTOS_SCHEME))
		return photosAssetURL(objc, file.uri.slice(PHOTOS_SCHEME.length));

	return objc.call(NSURL, 'URLWithString:', file.uri) as NativeObjectHandle | null;
}

function openImage(objc: ObjC, url: NativeObjectHandle): NativeObjectHandle | null {
	const CIImage = objc.getClass('CIImage');

	return CIImage
		? (objc.call(CIImage, 'imageWithContentsOfURL:', url) as NativeObjectHandle | null)
		: null;
}

function part<T>(objc: ObjC, image: NativeObjectHandle, key: string): T | undefined {
	return (objc.invoke(image, 'valueForKeyPath:', [`properties.${key}`]) ?? undefined) as
		| T
		| undefined;
}

function readMetadata(objc: ObjC, image: NativeObjectHandle): PhotoMetadata {
	const gps = part<GpsPart>(objc, image, '{GPS}');
	const tiff = part<TiffPart>(objc, image, '{TIFF}');
	const exif = part<ExifPart>(objc, image, '{Exif}');
	const location = locationOf(
		signedCoordinate(gps?.Latitude, gps?.LatitudeRef),
		signedCoordinate(gps?.Longitude, gps?.LongitudeRef),
	);
	const camera = [tiff?.Make, tiff?.Model].filter(Boolean).join(' ');
	const takenAt = exif?.DateTimeOriginal ?? tiff?.DateTime;

	return {
		...(location ? { location } : {}),
		...(camera ? { camera } : {}),
		...(takenAt ? { takenAt } : {}),
		...(tiff?.Software ? { software: tiff.Software } : {}),
	};
}

/**
 * @description Reads and removes photo metadata on iOS with Core Image: Photos library images through their full-size
 * file, files directly. Removing re-encodes the photo as a JPEG, upright, with no properties.
 * @param native The plugin's native bridge.
 * @returns The tools.
 */
export function createPhotoTools({ objc }: NativeBridge): PhotoTools | undefined {
	return {
		async inspect(file) {
			const url = await fileURL(objc, file);
			const image = url ? openImage(objc, url) : null;

			return image ? readMetadata(objc, image) : {};
		},
		async strip(file, _metadata, folder) {
			const url = await fileURL(objc, file);
			const image = url ? openImage(objc, url) : null;
			const NSURL = objc.getClass('NSURL');
			const NSDictionary = objc.getClass('NSDictionary');
			const CIContext = objc.getClass('CIContext');

			if (!image || !NSURL || !NSDictionary || !CIContext) return undefined;

			const empty = objc.call(NSDictionary, 'dictionary') as NativeObjectHandle;
			const orientation = Number(part<number>(objc, image, 'Orientation') ?? 1);
			const upright = objc.invoke(image, 'imageByApplyingCGOrientation:', [
				orientation,
			]) as NativeObjectHandle;
			const clean = objc.invoke(upright, 'imageBySettingProperties:', [
				empty,
			]) as NativeObjectHandle;
			const filename = asJpegName(file.filename ?? 'photo.jpg');
			const relative = `${folder}/${Date.now()}`;

			await fs.writeFile(`${relative}/.keep`, '');

			const path = `${fs.documentsPath}/${relative}/${filename}`;
			const output = objc.call(NSURL, 'fileURLWithPath:', path) as NativeObjectHandle;
			const context = objc.call(CIContext, 'context') as NativeObjectHandle;
			const written = await objc.invokeAsync(
				context,
				'writeJPEGRepresentationOfImage:toURL:colorSpace:options:error:',
				[clean, output, objc.invoke(image, 'colorSpace', []), empty, null],
			);

			return written
				? { uri: `file://${path}`, filename, mimeType: 'image/jpeg' }
				: undefined;
		},
	};
}

export default { createPhotoTools };
