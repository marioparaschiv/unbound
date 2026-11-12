import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const BLUR_TAG = 0x0b0b26;

type BlurredBubble = {
	width: number;
	height: number;
	tailSize: number;
	/** The blur's radius in points, 0 for none. */
	blur: number;
};

function rect(x: number, y: number, width: number, height: number) {
	'worklet';

	return { origin: { x, y }, size: { width, height } };
}

// The effect view takes its shape from a mask view, as an ancestor's layer mask would stop it blurring; the mask view's tag keeps the radius its effect was made with.
function blurIn(
	objc: NativeObjCBridge,
	bubble: NativeObjectHandle,
	fill: NativeObjectHandle,
): NativeObjectHandle | null {
	'worklet';
	const existing = objc.invoke(bubble, 'viewWithTag:', [BLUR_TAG]) as NativeObjectHandle | null;

	if (existing) return existing;

	const view = objc.invoke(
		objc.call(
			objc.getClass('UIVisualEffectView') as NativeObjectHandle,
			'alloc',
		) as NativeObjectHandle,
		'initWithEffect:',
		[null],
	) as NativeObjectHandle | null;
	const mask = objc.call(
		objc.getClass('UIView') as NativeObjectHandle,
		'new',
	) as NativeObjectHandle;
	const shape = objc.call(objc.getClass('CAShapeLayer') as NativeObjectHandle, 'new');

	if (!view || !mask || !shape) return null;

	objc.invoke(view, 'setTag:', [BLUR_TAG]);
	objc.invoke(view, 'setUserInteractionEnabled:', [false]);
	objc.invoke(objc.invoke(mask, 'layer', []) as NativeObjectHandle, 'addSublayer:', [shape]);
	objc.invoke(view, 'setMaskView:', [mask]);
	// Below the fill, whose color tints the blur.
	objc.invoke(bubble, 'insertSubview:belowSubview:', [view, fill]);

	return view;
}

/**
 * @description Blurs what lies behind a bubble, in the bubble's outline, under its fill; hides the blur when the bubble has none.
 * @param objc The UI scope's Objective-C bridge.
 * @param bubble The bubble view.
 * @param fill The bubble's fill view, which the blur sits below.
 * @param drawn The bubble's size, tail and blur radius.
 * @param outline The bubble's outline, as a `CGPath`.
 */
export function paintBlur(
	objc: NativeObjCBridge,
	bubble: NativeObjectHandle,
	fill: NativeObjectHandle,
	drawn: BlurredBubble,
	outline: unknown,
) {
	'worklet';

	if (drawn.blur <= 0) {
		const existing = objc.invoke(bubble, 'viewWithTag:', [
			BLUR_TAG,
		]) as NativeObjectHandle | null;

		if (existing) objc.invoke(existing, 'setHidden:', [true]);

		return;
	}

	const view = blurIn(objc, bubble, fill);
	const mask = view && (objc.invoke(view, 'maskView', []) as NativeObjectHandle | null);

	if (!view || !mask) return;

	// UNKNOWN: `sublayers` comes back as a JS array or an `NSArray` handle.
	const sublayers = objc.invoke(
		objc.invoke(mask, 'layer', []) as NativeObjectHandle,
		'sublayers',
		[],
	) as unknown;
	const shape = (
		Array.isArray(sublayers) ? sublayers : objc.array(sublayers as NativeObjectHandle)
	)[0] as NativeObjectHandle | undefined;

	if (!shape) return;

	const reach = drawn.width + drawn.tailSize;
	const CATransaction = objc.getClass('CATransaction') as NativeObjectHandle;

	if (Number(objc.invoke(mask, 'tag', [])) !== drawn.blur) {
		// UIKit's private `effectWithBlurRadius:` blurs without the tint and vibrancy of the public materials.
		const effect = objc.call(
			objc.getClass('UIBlurEffect') as NativeObjectHandle,
			'effectWithBlurRadius:',
			drawn.blur,
		);

		objc.invoke(view, 'setEffect:', [effect]);
		objc.invoke(mask, 'setTag:', [drawn.blur]);
	}

	objc.invoke(view, 'setFrame:', [
		objc.struct('CGRect', rect(-drawn.tailSize, 0, reach, drawn.height)),
	]);
	objc.invoke(mask, 'setFrame:', [objc.struct('CGRect', rect(0, 0, reach, drawn.height))]);
	// The outline starts at the bubble's left edge, the tail reaching left of it.
	// The shape is a bare layer, which would animate each change; the bubble moves with its cell at once.
	objc.call(CATransaction, 'begin');
	objc.call(CATransaction, 'setDisableActions:', true);
	objc.invoke(shape, 'setFrame:', [
		objc.struct('CGRect', rect(drawn.tailSize, 0, drawn.width, drawn.height)),
	]);
	objc.invoke(shape, 'setPath:', [outline]);
	objc.call(CATransaction, 'commit');
	objc.invoke(view, 'setHidden:', [false]);
}

export default { paintBlur };
