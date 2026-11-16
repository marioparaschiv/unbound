import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { Box } from '~/lib/geometry';
import { ellipsisLike, isolateStartAround } from '~/native/ios/preview-truncation';

const TEXT_VIEW_CLASS = 'DCDAttributedTextView';
const FITS_KEY = '__unboundChatBubblesAttributedPreviewFits';
const USES_LINE_FRAGMENT_ORIGIN = 1;
const HEIGHT_SLACK = 1;
const SEARCH_DEPTH = 6;

type Fit = { width: number; shown: string };

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

function fits(): Map<string, Fit> {
	'worklet';
	const holder = globalThis as unknown as Record<typeof FITS_KEY, Map<string, Fit> | undefined>;

	holder[FITS_KEY] ??= new Map();

	return holder[FITS_KEY];
}

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return boxed?.value ?? boxed ?? {};
}

function readRect(raw: unknown): Box {
	'worklet';
	const value = unbox(raw) as unknown as {
		origin?: { value?: { x?: number; y?: number }; x?: number; y?: number };
		size?: { value?: { width?: number; height?: number }; width?: number; height?: number };
	};
	const origin = value.origin?.value ?? value.origin;
	const size = value.size?.value ?? value.size;

	return {
		x: Number(origin?.x ?? 0),
		y: Number(origin?.y ?? 0),
		width: Number(size?.width ?? 0),
		height: Number(size?.height ?? 0),
	};
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	const list = objc.invoke(view, 'subviews', []);

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

function previewTextViewIn(
	objc: NativeObjCBridge,
	holder: NativeObjectHandle,
): NativeObjectHandle | undefined {
	'worklet';
	let level = [holder];

	for (let depth = 0; depth < SEARCH_DEPTH && level.length; depth++) {
		const next: NativeObjectHandle[] = [];

		for (const view of level) {
			if (objc.className(view) === TEXT_VIEW_CLASS) return view;

			next.push(...subviewsOf(objc, view));
		}

		level = next;
	}

	return undefined;
}

function plainOf(objc: NativeObjCBridge, text: NativeObjectHandle): string {
	'worklet';
	const string = objc.call(text, 'string');

	return typeof string === 'string' ? string : '';
}

function keyOf(objc: NativeObjCBridge, view: NativeObjectHandle): string {
	'worklet';

	return String(objc.call(view, 'hash') as number);
}

function textRoom(objc: NativeObjCBridge, view: NativeObjectHandle, width: number) {
	'worklet';
	const inset = unbox(objc.invoke(view, 'textContainerInset', []));
	const container = objc.invoke(view, 'textContainer', []) as NativeObjectHandle | null;
	const padding = container ? Number(objc.invoke(container, 'lineFragmentPadding', [])) || 0 : 0;
	const bounds = readRect(objc.invoke(view, 'bounds', []));

	return {
		width: width - padding * 2 - Number(inset.left ?? 0) - Number(inset.right ?? 0),
		height: bounds.height - Number(inset.top ?? 0) - Number(inset.bottom ?? 0),
	};
}

function heightAt(objc: NativeObjCBridge, text: NativeObjectHandle, width: number): number {
	'worklet';
	const rect = objc.invoke(text, 'boundingRectWithSize:options:context:', [
		objc.struct('CGSize', { width, height: 100000 }),
		USES_LINE_FRAGMENT_ORIGIN,
		null,
	]);

	return Math.ceil(readRect(rect).height);
}

function cutAt(
	objc: NativeObjCBridge,
	text: NativeObjectHandle,
	plain: string,
	length: number,
	token: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	let end = isolateStartAround(plain, length) ?? length;

	while (end > 0 && plain[end - 1]!.trim() === '') end--;

	const kept = objc.invoke(text, 'attributedSubstringFromRange:', [
		objc.struct('NSRange', { location: 0, length: end }),
	]) as NativeObjectHandle | null;
	const cut = kept ? (objc.invoke(kept, 'mutableCopy', []) as NativeObjectHandle | null) : null;

	if (cut) objc.invoke(cut, 'appendAttributedString:', [token]);

	return cut;
}

function truncatedText(
	objc: NativeObjCBridge,
	text: NativeObjectHandle,
	room: { width: number; height: number },
): NativeObjectHandle | null {
	'worklet';
	const limit = room.height + HEIGHT_SLACK;

	if (room.width <= 0 || room.height <= 0 || heightAt(objc, text, room.width) <= limit) {
		return null;
	}

	const token = ellipsisLike(objc, text);
	const plain = plainOf(objc, text);

	if (!token) return null;

	let low = 0;
	let high = plain.length;
	let best = cutAt(objc, text, plain, 0, token);

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		const candidate = cutAt(objc, text, plain, middle, token);

		if (candidate && heightAt(objc, candidate, room.width) <= limit) {
			best = candidate;
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	return best;
}

/**
 * @description Ends a quoted reply's preview with an ellipsis inside its quote box on Discord builds that draw it with
 * `DCDAttributedTextView`, which lays the preview out at the column's width rather than the bubble's.
 * @param objc The UI scope's Objective-C bridge.
 * @param holder The cell's header view, which holds the preview.
 * @param clip The quote box's clip in the holder's coordinates, or `undefined` once the cell shows no quote.
 */
export function fitAttributedPreview(
	objc: NativeObjCBridge,
	holder: NativeObjectHandle,
	clip: Box | undefined,
): void {
	'worklet';
	const view = previewTextViewIn(objc, holder);

	if (!view) return;

	const key = keyOf(objc, view);

	if (!clip) {
		fits().delete(key);

		return;
	}

	const current = objc.invoke(view, 'attributedText', []) as NativeObjectHandle | null;

	if (!current) return;

	const parent = objc.invoke(view, 'superview', []) as NativeObjectHandle;
	const frame = readRect(objc.invoke(view, 'frame', []));
	const origin = readRect(
		objc.invoke(parent, 'convertRect:toView:', [
			objc.struct('CGRect', {
				origin: { x: frame.x, y: frame.y },
				size: { width: frame.width, height: frame.height },
			}),
			holder,
		]),
	);
	const width = Math.floor(clip.x + clip.width - origin.x);
	const shown = plainOf(objc, current);
	const fit = fits().get(key);

	if (fit && fit.shown === shown && fit.width <= width) return;

	const fitted = truncatedText(objc, current, textRoom(objc, view, width));

	fits().set(key, { width, shown: fitted ? plainOf(objc, fitted) : shown });

	if (fitted) objc.invoke(view, 'setAttributedText:', [fitted]);
}

export default { fitAttributedPreview };
