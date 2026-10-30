import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

/** A `CGRect`, `CGPoint` or `CGSize` as the bridge returns it, plain or boxed in an `NSValue`. */
type NativeRectValue = {
	height?: number;
	origin?: NativeRectValue;
	size?: NativeRectValue;
	value?: NativeRectValue;
	width?: number;
	x?: number;
	y?: number;
};

export type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Size = {
	width: number;
	height: number;
};

// UNKNOWN: the bridge returns struct values untyped.
function unwrap(raw: unknown): NativeRectValue | undefined {
	const boxed = raw as NativeRectValue | null | undefined;

	return boxed?.value ?? boxed ?? undefined;
}

// UNKNOWN: a struct field the bridge returned untyped.
function finite(value: unknown): number | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	const number = Number(value);

	return Number.isFinite(number) ? number : undefined;
}

/**
 * @description Reads a `CGSize` the Objective-C bridge returned, boxed in an `NSValue` or not.
 * @param raw The bridge's return value from `contentSize`, `sizeThatFits:` and similar selectors.
 * @returns The size, or `undefined` when a field is missing or not finite.
 */
// UNKNOWN: the bridge returns struct values untyped.
export function parseSize(raw: unknown): Size | undefined {
	const size = unwrap(raw);
	const width = finite(size?.width);
	const height = finite(size?.height);

	return width === undefined || height === undefined ? undefined : { width, height };
}

/**
 * @description Reads a `CGRect` the Objective-C bridge returned, boxed in an `NSValue` or not, with its origin and size nested or flat.
 * @param raw The bridge's return value from `frame`, `bounds` and similar selectors.
 * @returns The rect, or `undefined` when a field is missing or not finite.
 */
// UNKNOWN: the bridge returns struct values untyped.
export function parseRect(raw: unknown): Rect | undefined {
	const rect = unwrap(raw);
	const origin = unwrap(rect?.origin);
	const size = parseSize(rect?.size ?? rect);
	const x = finite(origin?.x ?? rect?.x);
	const y = finite(origin?.y ?? rect?.y);

	return size && x !== undefined && y !== undefined ? { x, y, ...size } : undefined;
}

/**
 * @description Reads a `CGRect` or `CGSize` the Objective-C bridge returned, boxed in an `NSValue` or not.
 * @param raw The bridge's return value from `frame`, `bounds`, `sizeThatFits:` and similar selectors.
 * @returns The rect's fields, each `0` when the value does not carry it.
 */
// UNKNOWN: the bridge returns struct values untyped.
export function readRect(raw: unknown): Rect {
	const rect = unwrap(raw);

	return {
		x: Number(rect?.origin?.x ?? rect?.x ?? 0),
		y: Number(rect?.origin?.y ?? rect?.y ?? 0),
		width: Number(rect?.size?.width ?? rect?.width ?? 0),
		height: Number(rect?.size?.height ?? rect?.height ?? 0),
	};
}

/**
 * @description Builds a `CGRect` to pass to the Objective-C bridge.
 * @param objc The Objective-C bridge.
 * @param rect The rect's origin and size.
 * @returns The struct.
 */
export function toRect(objc: Pick<NativeObjCBridge, 'struct'>, rect: Rect): NativeObjectHandle {
	const { x, y, width, height } = rect;

	return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
}

export default { parseSize, parseRect, readRect, toRect };
