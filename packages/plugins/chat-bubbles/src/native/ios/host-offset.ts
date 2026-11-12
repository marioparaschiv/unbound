import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

const CONTENT_VIEW = 'UITableViewCellContentView';

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return (boxed?.value ?? boxed ?? {}) as Record<string, number>;
}

/**
 * @description Finds where the cell's content view starts in the cell, so a view drawn in it is placed by cell coordinates.
 * Row padding moves the content view, and swipe to reply moves it with a transform, which this leaves out so the view follows the swipe.
 * @param objc The Objective-C bridge.
 * @param view A view the plugin added to the cell.
 * @returns How far to shift the view's cell frame, `0` when it is not in a content view.
 */
export function hostOffset(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
): { x: number; y: number } {
	'worklet';
	const host = objc.invoke(view, 'superview', []) as NativeObjectHandle | null;

	if (!host || objc.className(host) !== CONTENT_VIEW) return { x: 0, y: 0 };

	const center = unbox(objc.invoke(host, 'center', []));
	const bounds = unbox(objc.invoke(host, 'bounds', []));
	const origin = unbox(bounds.origin ?? {});
	const size = unbox(bounds.size ?? {});

	return {
		x: Number(center.x ?? 0) - Number(size.width ?? 0) / 2 - Number(origin.x ?? 0),
		y: Number(center.y ?? 0) - Number(size.height ?? 0) / 2 - Number(origin.y ?? 0),
	};
}

export default hostOffset;
