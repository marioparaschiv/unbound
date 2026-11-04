/**
 * @description Picks the corner radius for an avatar, never rounder than a circle.
 * @param radius The chosen radius.
 * @param width The avatar's width.
 * @returns The corner radius to draw.
 */
export function cornerRadius(radius: number, width: number): number {
	return width > 0 ? Math.min(radius, width / 2) : radius;
}

export default { cornerRadius };
