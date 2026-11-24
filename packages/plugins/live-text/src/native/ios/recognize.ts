import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';

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

// Downloads in JS: NSData's own URL loader blocks the calling thread and is refused by hosts that reject its user agent.
async function downloadBase64(url: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	return toBase64(new Uint8Array(await response.arrayBuffer()));
}

/**
 * @description Reads the text in an image with Vision's text recognizer.
 * @param native The plugin's native bridge.
 * @param url The image's address.
 * @returns The recognized lines, top to bottom.
 */
export async function recognizeOnIOS({ objc }: NativeBridge, url: string): Promise<string[]> {
	const base64 = await downloadBase64(url);
	const data = objc.alloc('NSData');
	const handler = objc.alloc('VNImageRequestHandler');
	const request = objc.alloc('VNRecognizeTextRequest');
	const results = await objc.batch([
		{ target: data, selector: 'initWithBase64EncodedString:options:', args: [base64, 0] },
		{ target: classHandle(objc, 'NSDictionary'), selector: 'dictionary', args: [] },
		{ target: handler, selector: 'initWithData:options:', args: [result(0), result(1)] },
		{ target: request, selector: 'init', args: [] },
		{ target: result(3), selector: 'setRecognitionLevel:', args: [ACCURATE] },
		{ target: result(3), selector: 'setUsesLanguageCorrection:', args: [true] },
		{ target: classHandle(objc, 'NSArray'), selector: 'arrayWithObject:', args: [result(3)] },
		{ target: result(2), selector: 'performRequests:error:', args: [result(6), null] },
		{ target: result(3), selector: 'results', args: [] },
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
