import type { PathStep } from '~/lib/bubble-path';
import type { Fillets } from '~/lib/group';
import type { Box } from '~/lib/geometry';

/** How far a circle's quarter pulls its control points along each side, as a share of the radius. */
const CIRCLE_PULL = 0.5523;

const fixed = (value: number) => String(Math.round(value * 100) / 100);

/**
 * @description Writes a bubble's outline as SVG path data, which Android's `PathParser` turns into a `Path` in one call.
 * @param steps The outline's steps, from `bubblePath`, relative to the bubble's top left.
 * @param at Where the bubble's top left sits in the row.
 * @param scale How many pixels make one point.
 * @returns The path data, closed.
 */
export function pathData(steps: PathStep[], at: { x: number; y: number }, scale: number): string {
	const point = (x: number, y: number) =>
		`${fixed((at.x + x) * scale)} ${fixed((at.y + y) * scale)}`;
	const parts = steps.map((step, index) => {
		if (step.length === 6) {
			const [c1x, c1y, c2x, c2y, x, y] = step as [
				number,
				number,
				number,
				number,
				number,
				number,
			];

			return `C${point(c1x, c1y)} ${point(c2x, c2y)} ${point(x, y)}`;
		}

		return `${index === 0 ? 'M' : 'L'}${point(step[0]!, step[1]!)}`;
	});

	return parts.length ? `${parts.join(' ')} Z` : '';
}

/**
 * @description Writes the inward curves that join a bubble to a wider neighbour as SVG path data, each a corner square right of the bubble less a quarter circle.
 * @param frame The bubble's frame in the row.
 * @param fillets The size of the curve at the top and bottom right, 0 where there is none.
 * @param scale How many pixels make one point.
 * @returns The path data, one closed shape per curve, or an empty string when there are none.
 */
export function filletData(frame: Box, fillets: Fillets, scale: number): string {
	const right = frame.x + frame.width;
	const top = frame.y;
	const bottom = frame.y + frame.height;
	const point = (x: number, y: number) => `${fixed(x * scale)} ${fixed(y * scale)}`;
	const shapes: string[] = [];

	if (fillets.top > 0) {
		const size = fillets.top;
		const pull = size * CIRCLE_PULL;

		shapes.push(
			`M${point(right, top)} L${point(right + size, top)} C${point(right + size - pull, top)} ${point(right, top + size - pull)} ${point(right, top + size)} Z`,
		);
	}

	if (fillets.bottom > 0) {
		const size = fillets.bottom;
		const pull = size * CIRCLE_PULL;

		shapes.push(
			`M${point(right, bottom)} L${point(right, bottom - size)} C${point(right, bottom - size + pull)} ${point(right + size - pull, bottom)} ${point(right + size, bottom)} Z`,
		);
	}

	return shapes.join(' ');
}

export default { filletData, pathData };
