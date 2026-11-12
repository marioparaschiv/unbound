import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

const CONTENT_VIEW = 'UITableViewCellContentView';

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return (boxed?.value ?? boxed ?? {}) as Record<string, number>;
}

/**
 * @description Finds where a content view's coordinates start in its cell, leaving out any transform such as swipe to reply's.
 * @param objc The Objective-C bridge.
 * @param content The cell's content view.
 * @returns The offset of the content view's coordinates in the cell.
 */
export function contentOrigin(
	objc: NativeObjCBridge,
	content: NativeObjectHandle,
): { x: number; y: number } {
	'worklet';
	const center = unbox(objc.invoke(content, 'center', []));
	const bounds = unbox(objc.invoke(content, 'bounds', []));
	const origin = unbox(bounds.origin ?? {});
	const size = unbox(bounds.size ?? {});

	return {
		x: Number(center.x ?? 0) - Number(size.width ?? 0) / 2 - Number(origin.x ?? 0),
		y: Number(center.y ?? 0) - Number(size.height ?? 0) / 2 - Number(origin.y ?? 0),
	};
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

	return contentOrigin(objc, host);
}

/**
 * @description Moves the plugin's views in a content view back by however far the content view just moved, so they keep their place in the cell.
 * @param objc The Objective-C bridge.
 * @param content The cell's content view.
 * @param before Where the content view's coordinates started before it moved.
 * @param tags The tags of the views to keep in place.
 */
export function keepInCell(
	objc: NativeObjCBridge,
	content: NativeObjectHandle,
	before: { x: number; y: number },
	tags: number[],
) {
	'worklet';
	const after = contentOrigin(objc, content);
	const dx = before.x - after.x;
	const dy = before.y - after.y;

	if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

	for (const tag of tags) {
		const view = objc.invoke(content, 'viewWithTag:', [tag]) as NativeObjectHandle | null;

		if (
			!view ||
			!objc.call(
				objc.invoke(view, 'superview', []) as NativeObjectHandle,
				'isEqual:',
				content,
			)
		) {
			continue;
		}

		const center = unbox(objc.invoke(view, 'center', []));

		objc.invoke(view, 'setCenter:', [
			objc.struct('CGPoint', {
				x: Number(center.x ?? 0) + dx,
				y: Number(center.y ?? 0) + dy,
			}),
		]);
	}
}

export default hostOffset;
