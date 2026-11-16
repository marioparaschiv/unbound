import type { NativeBridge, NativeFFIType, NativePointer } from '@unbound-app/api/native';

const PREMULTIPLIED_LAST = 1;

/**
 * @description Decodes an image file into square RGBA pixels on iOS: `UIImage` loads it and Core Graphics draws its
 * `CGImage`, scaled to fill the square, into a packed bitmap.
 * @param native The plugin's native bridge.
 * @param path The image's absolute path.
 * @param size The square's width and height.
 * @returns The RGBA pixels, or `undefined` when the file is not an image UIKit can read.
 */
export function readPixels(
	{ objc, ffi }: NativeBridge,
	path: string,
	size: number,
): Uint8Array | undefined {
	const UIImage = objc.getClass('UIImage');
	const msgSend = ffi.symbol('objc_msgSend');

	if (!UIImage || !msgSend) return undefined;

	const cf = <T>(
		name: string,
		returnType: NativeFFIType,
		args: NativeFFIType[],
		...values: unknown[]
	) => ffi.call(ffi.symbol(name)!, { returnType, args }, ...values) as T;
	const image = objc.call(UIImage, 'imageWithContentsOfFile:', path);

	if (!image) return undefined;

	const cgImage = ffi.call(
		msgSend,
		{ returnType: 'pointer', args: ['object', 'selector'] },
		image,
		'CGImage',
	) as NativePointer | null;

	if (!cgImage) return undefined;

	const bytes = size * size * 4;
	const buffer = ffi.alloc(bytes);
	const colorSpace = cf<NativePointer>('CGColorSpaceCreateDeviceRGB', 'pointer', []);

	try {
		const bitmap = cf<NativePointer>(
			'CGBitmapContextCreate',
			'pointer',
			['pointer', 'u64', 'u64', 'u64', 'u64', 'pointer', 'u32'],
			buffer,
			size,
			size,
			8,
			size * 4,
			colorSpace,
			PREMULTIPLIED_LAST,
		);

		cf(
			'CGContextDrawImage',
			'void',
			['pointer', { struct: 'CGRect' }, 'pointer'],
			bitmap,
			objc.struct('CGRect', { origin: { x: 0, y: 0 }, size: { width: size, height: size } }),
			cgImage,
		);
		cf('CGContextRelease', 'void', ['pointer'], bitmap);

		return ffi.readBytes(buffer, bytes);
	} finally {
		cf('CGColorSpaceRelease', 'void', ['pointer'], colorSpace);
		ffi.free(buffer);
	}
}

export default { readPixels };
