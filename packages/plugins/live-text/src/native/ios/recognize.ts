import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const ACCURATE = 0;
const result = (index: number) => ({ $nativeBatchResult: index });

function classHandle(objc: NativeBridge['objc'], name: string): NativeObjectHandle {
	const handle = objc.getClass(name);

	if (!handle) throw new Error(`no ${name}`);

	return handle as unknown as NativeObjectHandle;
}

function isHandle(value: unknown): value is NativeObjectHandle {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Reads the text in an image with Vision's text recognizer, loading the image natively.
 * @param native The plugin's native bridge.
 * @param url The image's address.
 * @returns The recognized lines, top to bottom.
 */
export async function recognizeOnIOS({ objc }: NativeBridge, url: string): Promise<string[]> {
	const handler = objc.alloc('VNImageRequestHandler');
	const request = objc.alloc('VNRecognizeTextRequest');
	const results = await objc.batch([
		{ target: classHandle(objc, 'NSURL'), selector: 'URLWithString:', args: [url] },
		{
			target: classHandle(objc, 'NSData'),
			selector: 'dataWithContentsOfURL:',
			args: [result(0)],
		},
		{ target: classHandle(objc, 'NSDictionary'), selector: 'dictionary', args: [] },
		{ target: handler, selector: 'initWithData:options:', args: [result(1), result(2)] },
		{ target: request, selector: 'init', args: [] },
		{ target: result(4), selector: 'setRecognitionLevel:', args: [ACCURATE] },
		{ target: result(4), selector: 'setUsesLanguageCorrection:', args: [true] },
		{ target: classHandle(objc, 'NSArray'), selector: 'arrayWithObject:', args: [result(4)] },
		{ target: result(3), selector: 'performRequests:error:', args: [result(7), null] },
		{ target: result(4), selector: 'results', args: [] },
	]);
	const observations = results.at(-1);

	if (!Array.isArray(observations)) return [];

	return observations
		.filter(isHandle)
		.map((observation) => {
			const candidates = objc.call(observation, 'topCandidates:', 1);
			const first = Array.isArray(candidates) ? candidates[0] : null;
			const text = isHandle(first) ? objc.call(first, 'string') : null;

			return typeof text === 'string' ? text : '';
		})
		.filter(Boolean);
}

export default recognizeOnIOS;
