import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

/** The cell's views whose drawing `moveView` shifts through their bounds: the reply preview's holder, then the name row. */
const MOVED_VIEWS = ['_headerView', '_messageHeaderView'];

type BoxedRect = { value?: BoxedRect; origin?: BoxedRect; x?: number; y?: number };

function shifted(objc: NativeObjCBridge, view: NativeObjectHandle): boolean {
	'worklet';
	const raw = objc.invoke(view, 'bounds', []) as BoxedRect | null;
	const rect = raw?.value ?? raw;
	const origin = rect?.origin?.value ?? rect?.origin;

	return Boolean(Number(origin?.x ?? 0) || Number(origin?.y ?? 0));
}

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(view, 'subviews', []) as unknown;

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

// A shifted holder still tests touches against its own bounds, which no longer cover what it draws, so its
// subviews are asked directly, each at the point converted through the shift, and keep their own gestures.
function hitMoved(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	point: unknown,
	event: unknown,
): NativeObjectHandle | null {
	'worklet';

	for (const name of MOVED_VIEWS) {
		const holder = objc.getIvar(cell, name) as NativeObjectHandle | null;

		if (!holder || objc.invoke(holder, 'isHidden', []) || !shifted(objc, holder)) continue;

		for (const view of subviewsOf(objc, holder).reverse()) {
			const local = objc.invoke(view, 'convertPoint:fromView:', [point, cell]);
			const hit = objc.invoke(view, 'hitTest:withEvent:', [
				local,
				event,
			]) as NativeObjectHandle | null;

			if (hit) return hit;
		}
	}

	return null;
}

/**
 * @description Sends touches on a message row's moved name and reply preview to Discord's own views where they are drawn, so tapping the reply still jumps to its message and tapping the name still opens the profile.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param messageCell The message cell's class name.
 */
export function installMovedTaps(scope: NativeUIScope, messageCell: string) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook(messageCell, 'hitTest:withEvent:', {
		replace: ({ self, args, original }) => {
			try {
				const hit = hitMoved(objc, self, args[0], args[1]);

				if (hit) return hit;
			} catch (error) {
				console.error(
					`[Chat Bubbles] Failed to find the touched view of a message row: ${String(error)}`,
				);
			}

			return original(...args);
		},
	});
}

export default { installMovedTaps };
