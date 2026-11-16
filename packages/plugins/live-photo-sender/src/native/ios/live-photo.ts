import type {
	NativeBridge,
	NativeFFIType,
	NativeObjectHandle,
	NativePointer,
} from '@unbound-app/api/native';

const LIVE_PHOTO_SUBTYPE = 8;
const PAIRED_VIDEO = 9;
const FULL_SIZE_PAIRED_VIDEO = 10;
const TIMESCALE = 600;
const CMTIME_BYTES = 24;
const GIF_TYPE = 'com.compuserve.gif';

export type GifOptions = { maxSide: number; fps: number; maxSeconds: number };

type Bridge = Pick<NativeBridge, 'objc' | 'ffi'>;

function sender({ ffi }: Bridge) {
	const msgSend = ffi.symbol('objc_msgSend')!;

	return <T>(returnType: NativeFFIType, args: NativeFFIType[], ...values: unknown[]) =>
		ffi.call(msgSend, { returnType, args }, ...values) as T;
}

function assetOf({ objc }: Bridge, identifier: string): NativeObjectHandle | undefined {
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

/**
 * @description Whether a photo in the library is a Live Photo.
 * @param native The plugin's native bridge.
 * @param identifier The photo's local identifier.
 * @returns `true` for a Live Photo.
 */
export function isLivePhoto(native: Bridge, identifier: string): boolean {
	const asset = assetOf(native, identifier);
	const subtypes = asset
		? sender(native)<bigint | number>('u64', ['object', 'selector'], asset, 'mediaSubtypes')
		: 0;

	return (Number(subtypes) & LIVE_PHOTO_SUBTYPE) !== 0;
}

/**
 * @description Writes a Live Photo's video to a file, downloading it from iCloud when needed.
 * @param native The plugin's native bridge.
 * @param identifier The photo's local identifier.
 * @param path Where to write the video.
 * @returns Whether the video was written.
 */
export function writePairedVideo(
	native: NativeBridge,
	identifier: string,
	path: string,
): Promise<boolean> {
	const { objc } = native;
	const asset = assetOf(native, identifier);
	const Resource = objc.getClass('PHAssetResource');
	const Manager = objc.getClass('PHAssetResourceManager');
	const NSURL = objc.getClass('NSURL');

	if (!asset || !Resource || !Manager || !NSURL) return Promise.resolve(false);

	const listed = objc.call(Resource, 'assetResourcesForAsset:', asset) as
		| NativeObjectHandle[]
		| NativeObjectHandle
		| null;
	const resources = (
		Array.isArray(listed) ? listed : listed ? objc.array(listed) : []
	) as NativeObjectHandle[];
	const typeOf = (resource: NativeObjectHandle) =>
		Number(sender(native)<bigint | number>('i64', ['object', 'selector'], resource, 'type'));
	const video =
		resources.find((resource) => typeOf(resource) === FULL_SIZE_PAIRED_VIDEO) ??
		resources.find((resource) => typeOf(resource) === PAIRED_VIDEO);

	if (!video) return Promise.resolve(false);

	const options = objc.create('PHAssetResourceRequestOptions', 'init', []);

	objc.invoke(options, 'setNetworkAccessAllowed:', [true]);

	return new Promise((resolve) => {
		const done = objc.block({ returnType: 'void', args: ['object'] }, (error: unknown) =>
			resolve(!error),
		);

		objc.invoke(
			objc.call(Manager, 'defaultManager') as NativeObjectHandle,
			'writeDataForAssetResource:toFile:options:completionHandler:',
			[video, objc.call(NSURL, 'fileURLWithPath:', path), options, done],
		);
	});
}

function writeTime({ ffi }: Bridge, seconds: number): NativePointer {
	const time = ffi.alloc(CMTIME_BYTES);

	ffi.write(time, 'i64', BigInt(Math.round(seconds * TIMESCALE)), 0);
	ffi.write(time, 'i32', TIMESCALE, 8);
	ffi.write(time, 'u32', 1, 12);
	ffi.write(time, 'i64', 0n, 16);

	return time;
}

function durationOf(native: Bridge, asset: NativeObjectHandle): number {
	const { objc, ffi } = native;
	const boxed = objc.invoke(asset, 'valueForKey:', ['duration']) as NativeObjectHandle | null;
	const time = ffi.alloc(CMTIME_BYTES);

	try {
		if (!boxed) return 0;

		objc.invoke(boxed, 'getValue:size:', [time, CMTIME_BYTES]);

		const scale = Number(ffi.read(time, 'i32', 8));

		return scale > 0 ? Number(ffi.read(time, 'i64', 0)) / scale : 0;
	} finally {
		ffi.free(time);
	}
}

function ownedDictionary(native: Bridge): NativePointer {
	const send = sender(native);
	const allocated = send<NativePointer>(
		'pointer',
		['class', 'selector'],
		native.objc.getClass('NSMutableDictionary'),
		'alloc',
	);

	return send<NativePointer>('pointer', ['pointer', 'selector'], allocated, 'init');
}

function gifProperties(native: Bridge, key: string, value: number): NativePointer[] {
	const send = sender(native);
	const inner = ownedDictionary(native);
	const outer = ownedDictionary(native);

	send(
		'void',
		['pointer', 'selector', 'object', 'object'],
		inner,
		'setObject:forKey:',
		value,
		key,
	);
	send(
		'void',
		['pointer', 'selector', 'pointer', 'object'],
		outer,
		'setObject:forKey:',
		inner,
		'{GIF}',
	);

	return [outer, inner];
}

function release(native: Bridge, dictionaries: NativePointer[]) {
	for (const dictionary of dictionaries) {
		native.ffi.call(
			native.ffi.symbol('CFRelease')!,
			{ returnType: 'void', args: ['pointer'] },
			dictionary,
		);
	}
}

/**
 * @description Turns a video into a looping GIF with ImageIO, from frames `AVAssetImageGenerator` reads at a steady
 * rate, scaled to fit `maxSide`.
 * @param native The plugin's native bridge.
 * @param videoPath The video's absolute path.
 * @param gifPath Where to write the GIF.
 * @param options The largest side, frames per second and longest length.
 * @returns The GIF's width and height, or `undefined` when it couldn't be made.
 */
export function videoToGif(
	native: NativeBridge,
	videoPath: string,
	gifPath: string,
	{ maxSide, fps, maxSeconds }: GifOptions,
): { width: number; height: number } | undefined {
	const { objc, ffi } = native;
	const send = sender(native);
	const call = <T>(
		name: string,
		returnType: NativeFFIType,
		args: NativeFFIType[],
		...values: unknown[]
	) => ffi.call(ffi.symbol(name)!, { returnType, args }, ...values) as T;
	const NSURL = objc.getClass('NSURL')!;
	const asset = objc.call(
		objc.getClass('AVURLAsset')!,
		'URLAssetWithURL:options:',
		objc.call(NSURL, 'fileURLWithPath:', videoPath),
		null,
	) as NativeObjectHandle;
	const generator = objc.create('AVAssetImageGenerator', 'initWithAsset:', [asset]);
	const zero = writeTime(native, 0);

	objc.invoke(generator, 'setAppliesPreferredTrackTransform:', [true]);
	objc.invoke(generator, 'setMaximumSize:', [
		objc.struct('CGSize', { width: maxSide, height: maxSide }),
	]);

	for (const selector of [
		'setRequestedTimeToleranceBefore:',
		'setRequestedTimeToleranceAfter:',
	]) {
		send('void', ['object', 'selector', 'pointer'], generator, selector, zero);
	}

	ffi.free(zero);

	const seconds = Math.min(maxSeconds, durationOf(native, asset));
	const count = Math.max(1, Math.floor(seconds * fps));
	const destination = call<NativePointer | null>(
		'CGImageDestinationCreateWithURL',
		'pointer',
		['object', 'object', 'u64', 'pointer'],
		objc.call(NSURL, 'fileURLWithPath:', gifPath),
		GIF_TYPE,
		count,
		null,
	);

	if (!destination) return undefined;

	const frameProperties = gifProperties(native, 'DelayTime', 1 / fps);
	const fileProperties = gifProperties(native, 'LoopCount', 0);
	let size: { width: number; height: number } | undefined;

	call(
		'CGImageDestinationSetProperties',
		'void',
		['pointer', 'pointer'],
		destination,
		fileProperties[0],
	);

	for (let index = 0; index < count; index++) {
		const time = writeTime(native, index / fps);

		try {
			const image = send<NativePointer | null>(
				'pointer',
				['object', 'selector', 'pointer', 'pointer', 'pointer'],
				generator,
				'copyCGImageAtTime:actualTime:error:',
				time,
				null,
				null,
			);

			if (!image) continue;

			size ??= {
				width: Number(call('CGImageGetWidth', 'u64', ['pointer'], image)),
				height: Number(call('CGImageGetHeight', 'u64', ['pointer'], image)),
			};
			call(
				'CGImageDestinationAddImage',
				'void',
				['pointer', 'pointer', 'pointer'],
				destination,
				image,
				frameProperties[0],
			);
			call('CGImageRelease', 'void', ['pointer'], image);
		} finally {
			ffi.free(time);
		}
	}

	const finished = call<boolean>('CGImageDestinationFinalize', 'bool', ['pointer'], destination);

	call('CFRelease', 'void', ['pointer'], destination);
	release(native, [...frameProperties, ...fileProperties]);

	return finished ? size : undefined;
}

export default { isLivePhoto, writePairedVideo, videoToGif };
