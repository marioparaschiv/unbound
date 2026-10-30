import type {
	NativeFabricFrame as Frame,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { parseRect, toRect } from '@unbound-plugins/shared/native/rect';

/**
 * @description Reads a view's frame.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @returns The frame, or `null` when the call failed or returned no finite rect.
 */
export async function getFrame(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
): Promise<Frame | null> {
	return parseRect(await safeInvokeAsync(objc, view, 'frame')) ?? null;
}

/**
 * @description Sets a view's frame, ignoring a failed call.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @param frame The new frame.
 */
export async function setFrame(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	frame: Frame,
): Promise<void> {
	await safeInvokeAsync(objc, view, 'setFrame:', toRect(objc, frame));
}

/**
 * @description Reads a view's subviews.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @returns The subviews, or `[]` when the call failed.
 */
export async function getSubviews(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
): Promise<NativeObjectHandle[]> {
	const value = await safeInvokeAsync(objc, view, 'subviews');

	if (Array.isArray(value)) return value as NativeObjectHandle[];

	if (!value || typeof value !== 'object') return [];

	try {
		return objc.array(value as NativeObjectHandle) as NativeObjectHandle[];
	} catch {
		return [];
	}
}

export default { getFrame, setFrame, getSubviews };
