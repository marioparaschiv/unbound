import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

type BoxedValue = { value?: Record<string, number> } & Record<string, number>;

function unbox(raw: unknown): Record<string, number> {
	'worklet';
	const boxed = raw as BoxedValue | null;

	return (boxed?.value ?? boxed ?? {}) as Record<string, number>;
}

/**
 * @description Moves what the plugin's views in a message cell draw by however far swipe to reply moved the cell's content
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

		const bounds = unbox(objc.invoke(view, 'bounds', []));
		const origin = unbox(bounds.origin ?? {});
		const box = unbox(bounds.size ?? {});

		if (Math.abs(Number(origin.x ?? 0) + shift) < 0.01) continue;

		objc.invoke(view, 'setBounds:', [
			objc.struct('CGRect', {
				origin: { x: -shift, y: Number(origin.y ?? 0) },
				size: { width: Number(box.width ?? 0), height: Number(box.height ?? 0) },
			}),
		]);
	}
}

export default followSwipe;
