import type { NativeColor } from '~/tag-properties';

/**
 * @description Android's tag renderer reads colors as signed 32-bit integers, but `processColor` returns unsigned ones.
 * @param color A color returned by `processColor`.
 * @returns The color as a signed 32-bit integer.
 */
export function toRendererColor(color: NativeColor): NativeColor {
	return typeof color === 'number' ? color | 0 : color;
}

export default { toRendererColor };
