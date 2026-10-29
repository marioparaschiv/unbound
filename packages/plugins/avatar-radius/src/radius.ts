import { DEFAULT_RADIUS, MAXIMUM_RADIUS } from '~/constants';

/**
 * @description Reads a stored radius, falling back to the default for anything that is not a usable number.
 * @param value The stored setting.
 * @returns The radius in points, between 0 and the maximum.
 */
export function storedRadius(value: unknown): number {
	const radius = typeof value === 'number' ? value : Number(value);

	if (value === null || value === undefined || value === '' || !Number.isFinite(radius)) {
		return DEFAULT_RADIUS;
	}

	return Math.max(0, Math.min(MAXIMUM_RADIUS, Math.round(radius)));
}

/**
 * @description Picks the corner radius for an avatar, never rounder than a circle.
 * @param radius The chosen radius.
 * @param width The avatar's width.
 * @returns The corner radius to draw.
 */
export function cornerRadius(radius: number, width: number): number {
	return width > 0 ? Math.min(radius, width / 2) : radius;
}

export default { cornerRadius, storedRadius };
