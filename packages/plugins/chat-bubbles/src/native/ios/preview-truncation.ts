import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const OBJECT_REPLACEMENT = '\uFFFC';
const POP_ISOLATE = 0x2069;
const ISOLATE_STARTS = [0x2066, 0x2067, 0x2068];
const ELLIPSIS = '\u2026';

/**
 * @description Builds an ellipsis styled like the text's last visible character outside a mention or emoji run.
 * @param objc The UI scope's Objective-C bridge.
 * @param text The attributed text the ellipsis ends.
 * @returns The ellipsis as attributed text, or `null` when the text shows nothing to copy the style from.
 */
export function ellipsisLike(
	objc: NativeObjCBridge,
	text: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	const string = objc.call(text, 'string');
	const plain = typeof string === 'string' ? string : '';
	let index = plain.length - 1;
	let isolated = 0;

	for (; index >= 0; index--) {
		const code = plain.charCodeAt(index);

		if (code === POP_ISOLATE) isolated++;
		else if (ISOLATE_STARTS.includes(code)) isolated = Math.max(0, isolated - 1);
		else if (!isolated && plain[index] !== OBJECT_REPLACEMENT && plain[index].trim() !== '')
			break;
	}

	if (index < 0) return null;

	const sample = objc.invoke(text, 'attributedSubstringFromRange:', [
		objc.struct('NSRange', { location: index, length: 1 }),
	]) as NativeObjectHandle | null;
	const token = sample
		? (objc.invoke(sample, 'mutableCopy', []) as NativeObjectHandle | null)
		: null;

	if (!token) return null;

	objc.invoke(token, 'replaceCharactersInRange:withString:', [
		objc.struct('NSRange', { location: 0, length: 1 }),
		ELLIPSIS,
	]);

	return token;
}

/**
 * @description Finds where the outermost isolate run around a position opens, so a cut never splits a mention chip.
 * @param plain The text.
 * @param index The position a cut would fall at.
 * @returns The run's opening index, or `undefined` when the position is outside every run.
 */
export function isolateStartAround(plain: string, index: number): number | undefined {
	'worklet';
	const opens: number[] = [];

	for (let position = 0; position < plain.length; position++) {
		const code = plain.charCodeAt(position);

		if (ISOLATE_STARTS.includes(code)) {
			opens.push(position);
		} else if (code === POP_ISOLATE) {
			const open = opens.pop();

			if (open !== undefined && !opens.length && open < index && position >= index) {
				return open;
			}
		}
	}

	return undefined;
}

export default { ellipsisLike, isolateStartAround };
