import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const PRESS_TAG = 0x0b0b2c;
const SHADOW_IVAR = '_shadowView';
const SWIPE_IVAR = '_swipeToReplyView';

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	// UNKNOWN: `subviews` comes back as a JS array or an `NSArray` handle.
	const list = objc.invoke(view, 'subviews', []) as unknown;

	return (
		Array.isArray(list) ? list : list ? objc.array(list as NativeObjectHandle) : []
	) as NativeObjectHandle[];
}

function shownBubble(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	bubbleTag: number,
): NativeObjectHandle | null {
	'worklet';
	const bubble = objc.invoke(cell, 'viewWithTag:', [bubbleTag]) as NativeObjectHandle | null;

	if (!bubble || objc.invoke(bubble, 'isHidden', [])) return null;

	const [fill] = subviewsOf(objc, bubble);

	return fill ?? null;
}

function clearColor(objc: NativeObjCBridge): NativeObjectHandle {
	'worklet';

	return objc.call(
		objc.getClass('UIColor') as NativeObjectHandle,
		'clearColor',
	) as NativeObjectHandle;
}

/**
 * @description Paints Discord's press highlight inside the row's bubble, in its shape, instead of across the message's
 * content view, which is a rectangle the size of the content.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @param bubbleTag The tag of the bubble's holder view in the cell.
 * @param color The highlight's color, or `null` when the press ends.
 * @returns Whether the bubble took the highlight; `false` leaves it to the content view.
 */
export function paintPress(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	bubbleTag: number,
	color: NativeObjectHandle | null,
): boolean {
	'worklet';
	const fill = shownBubble(objc, cell, bubbleTag);
	const holder = fill && (objc.invoke(fill, 'superview', []) as NativeObjectHandle | null);
	const fillMask = fill
		? (objc.invoke(
				objc.invoke(fill, 'layer', []) as NativeObjectHandle,
				'mask',
				[],
			) as NativeObjectHandle | null)
		: null;

	if (!fill || !holder || !fillMask) return false;

	let press = objc.invoke(holder, 'viewWithTag:', [PRESS_TAG]) as NativeObjectHandle | null;

	if (!press) {
		press = objc.call(
			objc.getClass('UIView') as NativeObjectHandle,
			'new',
		) as NativeObjectHandle;
		objc.invoke(press, 'setTag:', [PRESS_TAG]);
		objc.invoke(press, 'setUserInteractionEnabled:', [false]);
		objc.invoke(holder, 'addSubview:', [press]);
	}

	const shape = objc.call(
		objc.getClass('CAShapeLayer') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle;

	objc.invoke(shape, 'setFrame:', [objc.invoke(fillMask, 'frame', [])]);
	objc.invoke(shape, 'setPath:', [objc.invoke(fillMask, 'path', [])]);
	objc.invoke(press, 'setFrame:', [objc.invoke(fill, 'frame', [])]);
	objc.invoke(press, 'setBounds:', [objc.invoke(fill, 'bounds', [])]);
	objc.invoke(objc.invoke(press, 'layer', []) as NativeObjectHandle, 'setMask:', [shape]);
	objc.invoke(press, 'setBackgroundColor:', [color]);
	objc.invoke(press, 'setHidden:', [!color]);

	return true;
}

/**
 * @description Clears the backdrop Discord slides in behind a swiped message, a chat-colored panel with hooked
 * corners and a drop shadow the size of the message's content, which cut into neighbouring bubbles.
 * @param objc The Objective-C bridge.
 * @param cell The message cell being swiped.
 * @param bubbleTag The tag of the bubble's holder view in the cell.
 */
export function clearSwipeBackdrop(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	bubbleTag: number,
) {
	'worklet';

	if (!shownBubble(objc, cell, bubbleTag)) return;

	const swipe = objc.getIvar(cell, SWIPE_IVAR) as NativeObjectHandle | null;
	const shadow = objc.getIvar(cell, SHADOW_IVAR) as NativeObjectHandle | null;

	if (swipe) objc.invoke(swipe, 'setBackgroundColor:', [clearColor(objc)]);

	if (shadow) objc.invoke(shadow, 'setHidden:', [true]);
}

/**
 * @description Clears a view's layer color without going through `setBackgroundColor:`, which the press hook watches.
 * @param objc The Objective-C bridge.
 * @param view The view.
 */
export function clearLayer(objc: NativeObjCBridge, view: NativeObjectHandle) {
	'worklet';
	const layer = objc.invoke(view, 'layer', []) as NativeObjectHandle;

	objc.invoke(layer, 'setBackgroundColor:', [objc.invoke(clearColor(objc), 'CGColor', [])]);
}

export default { paintPress, clearSwipeBackdrop, clearLayer };
