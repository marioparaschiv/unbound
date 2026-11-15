import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const QR_DETECTOR = 'CIDetectorTypeQRCode';

const result = (index: number) => ({ $nativeBatchResult: index });

function classHandle(objc: NativeBridge['objc'], name: string): NativeObjectHandle {
	const handle = objc.getClass(name);

	if (!handle) throw new Error(`no ${name}`);

	return handle as unknown as NativeObjectHandle;
}

/**
 * @description Reads the first QR code in an image with Core Image's QR detector, loading the image natively in one batch
 * so its data never crosses the bridge.
 * @param native The plugin's native bridge.
 * @param url The image's address.
 * @returns The code's text, or `undefined` when the image holds none.
 */
export async function scanOnIOS({ objc }: NativeBridge, url: string): Promise<string | undefined> {
	const results = await objc.batch([
		{ target: classHandle(objc, 'NSURL'), selector: 'URLWithString:', args: [url] },
		{
			target: classHandle(objc, 'NSData'),
			selector: 'dataWithContentsOfURL:',
			args: [result(0)],
		},
		{ target: classHandle(objc, 'CIImage'), selector: 'imageWithData:', args: [result(1)] },
		{
			target: classHandle(objc, 'CIDetector'),
			selector: 'detectorOfType:context:options:',
			args: [QR_DETECTOR, null, null],
		},
		{ target: result(3), selector: 'featuresInImage:', args: [result(2)] },
		{ target: result(4), selector: 'valueForKey:', args: ['messageString'] },
	]);
	const texts = results.at(-1);
	const first = Array.isArray(texts)
		? texts.find((text) => typeof text === 'string' && text.length)
		: undefined;

	return typeof first === 'string' ? first : undefined;
}

export default scanOnIOS;
