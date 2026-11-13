import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return (boxed?.value ?? boxed ?? {}) as Record<string, number>;
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

		if (Math.abs(Number(transform.tx ?? 0) - shift) < 0.01) continue;

		objc.invoke(view, 'setTransform:', [
			objc.struct('CGAffineTransform', { a: 1, b: 0, c: 0, d: 1, tx: shift, ty: 0 }),
		]);
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
