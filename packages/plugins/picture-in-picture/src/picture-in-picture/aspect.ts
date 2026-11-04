import {
	ANDROID_DEFAULT_ASPECT,
	ANDROID_MAX_ASPECT,
	ANDROID_MIN_ASPECT,
	ANDROID_TALLEST,
	ANDROID_WIDEST,
} from '~/constants';

const PRECISION = 1_000;

function isSize(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * @description Picks the shape of the picture in picture window from the video's size, within the limits Android allows.
 * @param width The video's width.
 * @param height The video's height.
 * @returns The width and height of the window's `Rational` aspect ratio, as whole numbers.
 */
export function windowAspect(
	width: number | undefined,
	height: number | undefined,
): readonly [number, number] {
	if (!isSize(width) || !isSize(height)) return ANDROID_DEFAULT_ASPECT;

	const exact = Number.isInteger(width) && Number.isInteger(height);
	const [numerator, denominator] = exact
		? [width, height]
		: [Math.round((width / height) * PRECISION), PRECISION];
	const ratio = numerator / denominator;

	if (ratio < ANDROID_MIN_ASPECT) return ANDROID_TALLEST;
	if (ratio > ANDROID_MAX_ASPECT) return ANDROID_WIDEST;

	return [numerator, denominator];
}
