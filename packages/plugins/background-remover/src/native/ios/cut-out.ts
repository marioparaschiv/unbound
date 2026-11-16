import type {
	NativeBridge,
	NativeFFIType,
	NativeObjectHandle,
	NativePointer,
} from '@unbound-app/api/native';

/**
 * @description Lifts the subjects out of an image on iOS 17 and later with Vision's foreground instance mask, cropped
 * to them, and writes the cutout as a PNG.
 * @param native The plugin's native bridge.
 * @param path The image's absolute path.
 * @returns The PNG as base64, or `undefined` when Vision finds no subject or the device can't run the request.
 */
export function cutOut({ objc, ffi }: NativeBridge, path: string): string | undefined {
	const msgSend = ffi.symbol('objc_msgSend');
	const Request = objc.getClass('VNGenerateForegroundInstanceMaskRequest');
	const NSDictionary = objc.getClass('NSDictionary');
	const NSArray = objc.getClass('NSArray');
	const NSURL = objc.getClass('NSURL');
	const CIImage = objc.getClass('CIImage');
	const CIContext = objc.getClass('CIContext');
	const UIImage = objc.getClass('UIImage');

	if (
		!msgSend ||
		!Request ||
		!NSDictionary ||
		!NSArray ||
		!NSURL ||
		!CIImage ||
		!CIContext ||
		!UIImage
	) {
		return undefined;
	}

	const send = <T>(returnType: NativeFFIType, args: NativeFFIType[], ...values: unknown[]) =>
		ffi.call(msgSend, { returnType, args }, ...values) as T;
	const handler = objc.create('VNImageRequestHandler', 'initWithURL:options:', [
		objc.call(NSURL, 'fileURLWithPath:', path),
		objc.call(NSDictionary, 'dictionary'),
	]);
	const request = objc.create('VNGenerateForegroundInstanceMaskRequest', 'init', []);

	objc.invoke(handler, 'performRequests:error:', [
		objc.call(NSArray, 'arrayWithObject:', request),
		null,
	]);

	const results = objc.invoke(request, 'results', []) as
		| NativeObjectHandle[]
		| NativeObjectHandle
		| null;
	const observation = (
		Array.isArray(results) ? results : results ? objc.array(results) : []
	)[0] as NativeObjectHandle | undefined;

	if (!observation) return undefined;

	const buffer = send<NativePointer | null>(
		'pointer',
		['object', 'selector', 'object', 'object', 'bool', 'pointer'],
		observation,
		'generateMaskedImageOfInstances:fromRequestHandler:croppedToInstancesExtent:error:',
		objc.invoke(observation, 'allInstances', []),
		handler,
		true,
		null,
	);

	if (!buffer) return undefined;

	const pixelSize = (name: string) =>
		Number(ffi.call(ffi.symbol(name)!, { returnType: 'u64', args: ['pointer'] }, buffer));
	const image = send<NativePointer>(
		'pointer',
		['class', 'selector', 'pointer'],
		CIImage,
		'imageWithCVPixelBuffer:',
		buffer,
	);
	const cgImage = send<NativePointer | null>(
		'pointer',
		['object', 'selector', 'pointer', { struct: 'CGRect' }],
		objc.call(CIContext, 'context'),
		'createCGImage:fromRect:',
		image,
		objc.struct('CGRect', {
			origin: { x: 0, y: 0 },
			size: {
				width: pixelSize('CVPixelBufferGetWidth'),
				height: pixelSize('CVPixelBufferGetHeight'),
			},
		}),
	);

	if (!cgImage) return undefined;

	try {
		const uiImage = send<NativePointer>(
			'pointer',
			['class', 'selector', 'pointer'],
			UIImage,
			'imageWithCGImage:',
			cgImage,
		);
		const png = ffi.call(
			ffi.symbol('UIImagePNGRepresentation')!,
			{ returnType: 'pointer', args: ['pointer'] },
			uiImage,
		) as NativePointer | null;

		return png
			? String(
					send(
						'object',
						['pointer', 'selector', 'u64'],
						png,
						'base64EncodedStringWithOptions:',
						0,
					),
				)
			: undefined;
	} finally {
		ffi.call(ffi.symbol('CGImageRelease')!, { returnType: 'void', args: ['pointer'] }, cgImage);
	}
}

export default { cutOut };
