type NativeRectValue = {
	height?: number;
	origin?: { x?: number; y?: number };
	size?: { height?: number; width?: number };
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

/**
 * @description Reads a `CGRect` or `CGSize` the Objective-C bridge returned, boxed in an `NSValue` or not.
 * @param raw The bridge's return value from `frame`, `bounds`, `sizeThatFits:` and similar selectors.
 * @returns The rect's fields, each `0` when the value does not carry it.
 */
// UNKNOWN: the bridge returns struct values untyped.
export function readRect(raw: unknown): Rect {
	const boxed = raw as NativeRectValue | null | undefined;
	const rect = boxed?.value ?? boxed;

	return {
		x: Number(rect?.origin?.x ?? rect?.x ?? 0),
		y: Number(rect?.origin?.y ?? rect?.y ?? 0),
		width: Number(rect?.size?.width ?? rect?.width ?? 0),
		height: Number(rect?.size?.height ?? rect?.height ?? 0),
	};
}

export default { readRect };
