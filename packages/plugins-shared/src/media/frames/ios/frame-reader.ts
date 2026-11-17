import type {
	NativeBridge,
	NativeFFIType,
	NativeObjectHandle,
	NativePointer,
} from '@unbound-app/api/native';

import type { Frame, FrameOptions, FrameReader } from '../frame-reader';
import { cropRect, outputSize } from '../frame-size';

const TIMESCALE = 600;
const PREMULTIPLIED_LAST = 1;
const CMTIME_BYTES = 24;

type ObjC = NativeBridge['objc'];

type Ffi = NativeBridge['ffi'];

type BoxedRect = { value?: { size?: { width?: number; height?: number } } };

function writeTime(ffi: Ffi, seconds: number): NativePointer {
	const time = ffi.alloc(CMTIME_BYTES);

	ffi.write(time, 'i64', BigInt(Math.round(seconds * TIMESCALE)), 0);
	ffi.write(time, 'i32', TIMESCALE, 8);
	ffi.write(time, 'u32', 1, 12);
	ffi.write(time, 'i64', 0n, 16);

	return time;
}

function readSeconds(ffi: Ffi, objc: ObjC, boxed: NativeObjectHandle): number {
	const time = ffi.alloc(CMTIME_BYTES);

	try {
		objc.invoke(boxed, 'getValue:size:', [time, CMTIME_BYTES]);

		const value = Number(ffi.read(time, 'i64', 0));
		const scale = Number(ffi.read(time, 'i32', 8));

		return scale > 0 ? value / scale : 0;
	} finally {
		ffi.free(time);
	}
}

function sizeOf(objc: ObjC, image: NativeObjectHandle) {
	const extent = objc.invoke(image, 'extent', []) as BoxedRect;

	return {
		width: Number(extent.value?.size?.width ?? 0),
		height: Number(extent.value?.size?.height ?? 0),
	};
}

function transformed(objc: ObjC, image: NativeObjectHandle, scale: number, tx: number, ty: number) {
	return objc.invoke(image, 'imageByApplyingTransform:', [
		objc.struct('CGAffineTransform', {
			a: scale,
			b: 0,
			c: 0,
			d: scale,
			tx,
			ty,
		}),
	]) as NativeObjectHandle;
}

function filter(
	objc: ObjC,
	name: string,
	values: Record<string, unknown>,
): NativeObjectHandle | null {
	const CIFilter = objc.getClass('CIFilter');
	const made = CIFilter
		? (objc.call(CIFilter, 'filterWithName:', name) as NativeObjectHandle | null)
		: null;

	if (!made) return null;

	for (const [key, value] of Object.entries(values))
		objc.invoke(made, 'setValue:forKey:', [value, key]);

	return objc.invoke(made, 'outputImage', []) as NativeObjectHandle | null;
}

function captioned(objc: ObjC, image: NativeObjectHandle, caption: string, width: number) {
	const fontSize = Math.max(14, Math.round(width / 12));
	const text = filter(objc, 'CITextImageGenerator', {
		inputText: caption,
		inputFontName: 'HelveticaNeue-Bold',
		inputFontSize: fontSize,
		inputScaleFactor: 1,
	});

	if (!text) return image;

	const white = filter(objc, 'CIColorInvert', { inputImage: text });
	const size = sizeOf(objc, text);
	const x = Math.max(0, (width - size.width) / 2);
	const y = Math.round(fontSize * 0.4);
	let result = image;

	for (const [dx, dy] of [
		[-2, 0],
		[2, 0],
		[0, -2],
		[0, 2],
		[-1, -1],
		[1, 1],
		[-1, 1],
		[1, -1],
	]) {
		result = objc.invoke(
			transformed(objc, text, 1, x + dx!, y + dy!),
			'imageByCompositingOverImage:',
			[result],
		) as NativeObjectHandle;
	}

	return white
		? (objc.invoke(transformed(objc, white, 1, x, y), 'imageByCompositingOverImage:', [
				result,
			]) as NativeObjectHandle)
		: result;
}

/**
 * @description Reads video frames on iOS. `AVAssetImageGenerator` takes `CMTime`s, which the bridge has no layout for,
 * so it is called through `objc_msgSend` with times written by hand; arm64 passes a 24-byte `CMTime` by pointer. Core
 * Image crops, scales and captions each frame and renders its RGBA bytes.
 * @param native The plugin's native bridge.
 * @param path The video's absolute path.
 * @returns The reader, or `undefined` when the video can't be opened.
 */
export function createFrameReader(
	{ objc, ffi }: NativeBridge,
	path: string,
): FrameReader | undefined {
	const NSURL = objc.getClass('NSURL');
	const AVURLAsset = objc.getClass('AVURLAsset');
	const CIImage = objc.getClass('CIImage');
	const CIContext = objc.getClass('CIContext');
	const msgSend = ffi.symbol('objc_msgSend');

	if (!NSURL || !AVURLAsset || !CIImage || !CIContext || !msgSend) return undefined;

	const url = objc.call(NSURL, 'fileURLWithPath:', path) as NativeObjectHandle;
	const asset = objc.call(
		AVURLAsset,
		'URLAssetWithURL:options:',
		url,
		null,
	) as NativeObjectHandle;
	const generator = objc.create('AVAssetImageGenerator', 'initWithAsset:', [asset]);
	const context = objc.call(CIContext, 'context') as NativeObjectHandle;
	const zero = writeTime(ffi, 0);
	const colorSpace = cf<NativePointer>('CGColorSpaceCreateDeviceRGB', 'pointer', []);

	objc.invoke(generator, 'setAppliesPreferredTrackTransform:', [true]);

	for (const selector of [
		'setRequestedTimeToleranceBefore:',
		'setRequestedTimeToleranceAfter:',
	]) {
		ffi.call(
			msgSend,
			{ returnType: 'void', args: ['object', 'selector', 'pointer'] },
			generator,
			selector,
			zero,
		);
	}

	ffi.free(zero);

	function grab(seconds: number): NativeObjectHandle | null {
		const time = writeTime(ffi, seconds);

		try {
			const image = ffi.call(
				msgSend!,
				{
					returnType: 'pointer',
					args: ['object', 'selector', 'pointer', 'pointer', 'pointer'],
				},
				generator,
				'copyCGImageAtTime:actualTime:error:',
				time,
				null,
				null,
			) as NativePointer | null;

			if (!image) return null;

			const frame = objc.call(CIImage!, 'imageWithCGImage:', image) as NativeObjectHandle;

			cf('CGImageRelease', 'void', ['pointer'], image);

			return frame;
		} finally {
			ffi.free(time);
		}
	}

	function cf<T>(
		name: string,
		returnType: NativeFFIType,
		args: NativeFFIType[],
		...values: unknown[]
	): T {
		return ffi.call(ffi.symbol(name)!, { returnType, args }, ...values) as T;
	}

	function drawPacked(
		cgImage: NativePointer,
		buffer: NativePointer,
		width: number,
		height: number,
	) {
		const bitmap = cf<NativePointer>(
			'CGBitmapContextCreate',
			'pointer',
			['pointer', 'u64', 'u64', 'u64', 'u64', 'pointer', 'u32'],
			buffer,
			width,
			height,
			8,
			width * 4,
			colorSpace,
			PREMULTIPLIED_LAST,
		);

		cf(
			'CGContextDrawImage',
			'void',
			['pointer', { struct: 'CGRect' }, 'pointer'],
			bitmap,
			objc.struct('CGRect', {
				origin: { x: 0, y: 0 },
				size: { width, height },
			}),
			cgImage,
		);
		cf('CGContextRelease', 'void', ['pointer'], bitmap);
	}

	function render(image: NativeObjectHandle, width: number, height: number): Uint8Array {
		const bytes = width * height * 4;
		const buffer = ffi.alloc(bytes);
		const cgImage = objc.invoke(context, 'createCGImage:fromRect:', [
			image,
			objc.struct('CGRect', {
				origin: { x: 0, y: 0 },
				size: { width, height },
			}),
		]) as NativePointer;

		try {
			drawPacked(cgImage, buffer, width, height);

			return ffi.readBytes(buffer, bytes);
		} finally {
			cf('CGImageRelease', 'void', ['pointer'], cgImage);
			ffi.free(buffer);
		}
	}

	return {
		duration() {
			const boxed = objc.invoke(asset, 'valueForKey:', [
				'duration',
			]) as NativeObjectHandle | null;

			return boxed ? readSeconds(ffi, objc, boxed) : 0;
		},
		frame(seconds: number, { width, crop, caption }: FrameOptions): Frame | undefined {
			const image = grab(seconds);

			if (!image) return undefined;

			const source = sizeOf(objc, image);
			const rect = cropRect(source.width, source.height, crop);
			const size = outputSize(rect, width);
			const cropped = objc.invoke(image, 'imageByCroppingToRect:', [
				objc.struct('CGRect', {
					origin: { x: rect.x, y: rect.y },
					size: { width: rect.width, height: rect.height },
				}),
			]) as NativeObjectHandle;
			const scale = size.width / rect.width;
			let scaled = transformed(objc, cropped, scale, -rect.x * scale, -rect.y * scale);

			if (caption) scaled = captioned(objc, scaled, caption, size.width);

			return { ...size, rgba: render(scaled, size.width, size.height) };
		},
		close() {
			cf('CGColorSpaceRelease', 'void', ['pointer'], colorSpace);
		},
	};
}

export default { createFrameReader };
