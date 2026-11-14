/**
 * @description Reads the size setting as a factor of Discord's sticker size.
 * @param value The stored percentage.
 * @returns The factor, 1 for anything unknown.
 */
export function parseScale(value: string): number {
	const percent = Number(value);

	return Number.isFinite(percent) && percent >= 25 && percent <= 300 ? percent / 100 : 1;
}

const EXACTLY = 0x40000000;
const MODE_MASK = 0xc0000000;
const SIZE_MASK = 0x3fffffff;

/**
 * @description Scales an Android `MeasureSpec` to an exact size, so a view lays out at the scaled size whatever its parent asked.
 * @param spec The measure spec Discord passed.
 * @param scale The factor.
 * @returns The scaled spec, or the same one when it has no size to scale.
 */
export function scaleMeasureSpec(spec: number, scale: number): number {
	'worklet';
	const size = spec & SIZE_MASK;
	const mode = spec & MODE_MASK;

	if (!size || mode === 0 || scale === 1) return spec;

	return (Math.max(1, Math.round(size * scale)) & SIZE_MASK) | EXACTLY;
}
