import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return (boxed?.value ?? boxed ?? {}) as Record<string, number>;
}

const SWIPE_ANIMATION_KEY = 'unbound.chat-bubbles.swipe';
const SWIPE_INDICATOR_CLASS = 'DCDSwipeToReplyView';

function animateLike(
	objc: NativeObjCBridge,
	content: NativeObjectHandle,
	view: NativeObjectHandle,
	from: number,
	to: number,
) {
	'worklet';
	const contentLayer = objc.invoke(content, 'layer', []) as NativeObjectHandle;
	const running = objc.invoke(contentLayer, 'animationForKey:', [
		'position',
	]) as NativeObjectHandle | null;

	const layer = objc.invoke(view, 'layer', []) as NativeObjectHandle;

	if (!running) {
		objc.invoke(layer, 'removeAnimationForKey:', [SWIPE_ANIMATION_KEY]);

		return;
	}

	const animation = objc.invoke(running, 'copy', []) as NativeObjectHandle;

	objc.invoke(animation, 'setKeyPath:', ['transform.translation.x']);
	objc.invoke(animation, 'setAdditive:', [false]);
	objc.invoke(animation, 'setFromValue:', [from]);
	objc.invoke(animation, 'setToValue:', [to]);
	objc.invoke(animation, 'setRemovedOnCompletion:', [true]);
	objc.invoke(layer, 'addAnimation:forKey:', [animation, SWIPE_ANIMATION_KEY]);
}

/**
 * @description Finds the reply or edit icon Discord reveals beside a message's content while it is swiped.
 * @param objc The Objective-C bridge.
 * @param content The cell's content view.
 * @returns The icon's view, or `null` when the row has none.
 */
export function swipeIndicator(
	objc: NativeObjCBridge,
	content: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(content, 'subviews', []) as unknown;
	const views = (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];

	return views.find((view) => objc.className(view) === SWIPE_INDICATOR_CLASS) ?? null;
}

/**
 * @description Translates the plugin's views in a message cell by however far swipe to reply moved the cell's content
 * view sideways, so the bubble and the avatar slide with the message and settle back with it.
 * @param objc The Objective-C bridge.
 * @param content The cell's content view.
 * @param tags The tags of the plugin's views in the cell.
 */
export function followSwipe(objc: NativeObjCBridge, content: NativeObjectHandle, tags: number[]) {
	'worklet';
	const cell = objc.invoke(content, 'superview', []) as NativeObjectHandle | null;

	if (!cell) return;

	const center = unbox(objc.invoke(content, 'center', []));
	const size = unbox(unbox(objc.invoke(content, 'bounds', [])).size ?? {});
	const shift = Number(center.x ?? 0) - Number(size.width ?? 0) / 2;

	if (!Number.isFinite(shift)) return;

	for (const tag of tags) {
		const view = objc.invoke(cell, 'viewWithTag:', [tag]) as NativeObjectHandle | null;
		const parent = view && (objc.invoke(view, 'superview', []) as NativeObjectHandle | null);

		if (!view || !parent || !objc.call(parent, 'isEqual:', cell)) continue;

		const transform = unbox(objc.invoke(view, 'transform', []));
		const from = Number(transform.tx ?? 0);

		if (Math.abs(from - shift) < 0.01) continue;

		objc.invoke(view, 'setTransform:', [
			objc.struct('CGAffineTransform', { a: 1, b: 0, c: 0, d: 1, tx: shift, ty: 0 }),
		]);
		animateLike(objc, content, view, from, shift);
	}
}

/**
 * @description Sets a view's frame as if it were untransformed, then puts back the swipe translation `followSwipe` gave it.
 * @param objc The Objective-C bridge.
 * @param view The bubble or avatar holder to place.
 * @param frame The frame to give it.
 */
export function placeFollowingSwipe(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	frame: unknown,
) {
	'worklet';
	const transform = objc.invoke(view, 'transform', []);

	objc.invoke(view, 'setTransform:', [
		objc.struct('CGAffineTransform', { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }),
	]);
	objc.invoke(view, 'setFrame:', [frame]);
	objc.invoke(view, 'setTransform:', [transform]);
}

export default followSwipe;
