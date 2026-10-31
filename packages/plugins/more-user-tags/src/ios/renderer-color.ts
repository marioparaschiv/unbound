import type { NativeColor } from '~/tag-properties';

/**
 * @description iOS's tag renderer accepts colors exactly as `processColor` returns them.
 * @param color A color returned by `processColor`.
 * @returns The same color.
 */
export function toRendererColor(color: NativeColor): NativeColor {
	return color;
}

export default { toRendererColor };
