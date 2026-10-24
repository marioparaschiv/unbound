import type {
	NativeFabricFrame as Frame,
	NativeFabricSize as Size,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';

/** A CGRect, CGPoint, or CGSize as the bridge returns it, plain or boxed in `value`. */
type RawStruct =
	| {
			value?: RawStruct;
			origin?: RawStruct;
			size?: RawStruct;
			x?: number;
			y?: number;
			width?: number;
			height?: number;
	  }
	| null
	| undefined;

function unwrap(struct: RawStruct): RawStruct {
	return struct?.value ?? struct;
}

function finite(...values: number[]): boolean {
	return values.every(Number.isFinite);
}

/**
 * @description Reads a `CGSize` returned by the bridge.
 * @param value The raw bridge return value.
 * @returns The size, or `null` when it is missing or not finite.
 */
export function readSize(
	/* UNKNOWN: an untyped bridge return value. */ value: unknown,
): Size | null {
	const size = unwrap(value as RawStruct);
	const width = Number(size?.width);
	const height = Number(size?.height);

	return finite(width, height) ? { width, height } : null;
}

/**
 * @description Reads a `CGRect` returned by the bridge.
 * @param value The raw bridge return value.
 * @returns The frame, or `null` when it is missing or not finite.
 */
export function readFrame(
	/* UNKNOWN: an untyped bridge return value. */ value: unknown,
): Frame | null {
	const rect = unwrap(value as RawStruct);
	const origin = unwrap(rect?.origin);
	const size = readSize(rect?.size);
	const x = Number(origin?.x);
	const y = Number(origin?.y);

	return size && finite(x, y) ? { x, y, ...size } : null;
}

/**
 * @description Builds a `CGRect` to pass to the bridge.
 * @param objc The Objective-C bridge from `context.native`.
 * @param frame The rect's origin and size.
 * @returns The struct handle.
 */
export function toRect(objc: NativeObjCBridge, { x, y, width, height }: Frame): NativeObjectHandle {
	return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
}

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
	return readFrame(await safeInvokeAsync(objc, view, 'frame'));
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

export default { readSize, readFrame, toRect, getFrame, setFrame, getSubviews };
