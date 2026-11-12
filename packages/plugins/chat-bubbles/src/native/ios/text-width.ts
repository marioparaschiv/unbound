import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { readRect } from '@unbound-plugins/shared/native/ios/rect';

const TEXT_MEASURE_HEIGHT = 100_000;
const USES_LINE_FRAGMENT_ORIGIN = 1;
const BLOCK_BORDER = 'YYTextBlockBorder';

/**
 * @description Measures how wide a message label's text draws, wrapped to the label's width.
 * @param objc The Objective-C bridge.
 * @param view The label.
 * @param limit The label's width.
 * @returns The text's width in points, the whole limit for text with a block border such as a code block, or 0 without text.
 */
export async function textWidth(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	limit: number,
): Promise<number> {
	const [text, measured, description] = await objc
		.batch([
			{ target: view, selector: 'attributedText', args: [] },
			{
				target: { $nativeBatchResult: 0 },
				selector: 'boundingRectWithSize:options:context:',
				args: [
					objc.struct('CGSize', { width: limit, height: TEXT_MEASURE_HEIGHT }),
					USES_LINE_FRAGMENT_ORIGIN,
					null,
				],
			},
			{ target: { $nativeBatchResult: 0 }, selector: 'description', args: [] },
		])
		.catch(() => [null, null, null]);

	if (!text) return 0;

	// A block border, such as a code block's box, spans the label's whole width, past the glyphs the text measures.
	if (typeof description === 'string' && description.includes(BLOCK_BORDER)) return limit;

	return Math.ceil(readRect(measured).width);
}

export default { textWidth };
