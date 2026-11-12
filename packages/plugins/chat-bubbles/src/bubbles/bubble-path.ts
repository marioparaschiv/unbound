import { Corner, type TailSide } from '~/bubbles/group';

export type Radii = { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

/** `[x, y]` moves or draws a line there, the first step moves; `[c1x, c1y, c2x, c2y, x, y]` draws a cubic curve. */
export type PathStep = number[];

type Point = [number, number];

/** The side whose left corner grows a tail, and how far the tail reaches out, in points. */
export type PathTail = { side: TailSide; size: number };

/** How far a circle's quarter pulls its control points along each side, as a share of the radius. */
const CIRCLE_PULL = 0.5523;

// Apple's continuous corner, the top right one, as cubic curves from the top edge to the right edge, in radii from the corner.
const CONTINUOUS: Point[][] = [
	[
		[-1.08849323, 0],
		[-0.86840689, 0],
		[-0.63149399, 0.074911],
	],
	[
		[-0.37282392, 0.16906001],
		[-0.16906001, 0.37282392],
		[-0.074911, 0.63149399],
	],
	[
		[0, 0.86840689],
		[0, 1.08849323],
		[0, 1.52866483],
	],
];
const CONTINUOUS_EXTENT = 1.52866483;

const CIRCULAR: Point[][] = [
	[
		[-1 + CIRCLE_PULL, 0],
		[0, 1 - CIRCLE_PULL],
		[0, 1],
	],
];

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * @description Draws a bubble's outline with its own radius at each corner, clockwise from the top edge.
 * @param width The bubble's width.
 * @param height The bubble's height.
 * @param radii Each corner's radius; 0 leaves it square.
 * @param continuous Whether corners use Apple's continuous curve rather than a circular one.
 * @param tail The tail grown out of a left corner, left of the bubble, so its fill and outline follow it as one shape.
 * @returns The outline's steps, to replay into a `UIBezierPath`.
 */
export function bubblePath(
	width: number,
	height: number,
	radii: Radii,
	continuous: boolean,
	tail?: PathTail,
): PathStep[] {
	const shape = continuous ? CONTINUOUS : CIRCULAR;
	const extent = continuous ? CONTINUOUS_EXTENT : 1;
	// Each corner turns the top right one a quarter further clockwise, about its own point of the bubble.
	const corners: { radius: number; at: Point; turn: (point: Point) => Point }[] = [
		{ radius: radii.topRight, at: [width, 0], turn: ([x, y]) => [x, y] },
		{ radius: radii.bottomRight, at: [width, height], turn: ([x, y]) => [-y, x] },
		{ radius: radii.bottomLeft, at: [0, height], turn: ([x, y]) => [-x, -y] },
		{ radius: radii.topLeft, at: [0, 0], turn: ([x, y]) => [y, -x] },
	];
	const steps: PathStep[] = [];

	for (const { radius, at, turn } of corners) {
		const place = ([x, y]: Point) => {
			const [dx, dy] = turn([x * radius, y * radius]);

			return [round(at[0] + dx), round(at[1] + dy)];
		};

		// The tail's corner is square: the bottom edge runs out to the tail's tip and back up to the left edge, or the left edge up and out to the top edge.
		if (tail && tail.size > 0 && at[0] === 0) {
			const size = round(tail.size);

			if (tail.side === 'bottom' && at[1] === height) {
				steps.push([-size, height], [0, round(height - size)]);
				continue;
			}

			if (tail.side === 'top' && at[1] === 0) {
				steps.push([0, size], [-size, 0]);
				continue;
			}
		}

		steps.push(place([-extent, 0]));

		if (radius <= 0) continue;

		for (const [first, second, end] of shape) {
			steps.push([...place(first!), ...place(second!), ...place(end!)]);
		}
	}

	return steps;
}

/**
 * @description Gives each corner of a bubble its radius: the full one where it rounds, none where a tail grows out, and a slight one elsewhere, so a grouped bubble's joins look softened rather than cut.
 * @param corners The rounded corners, as a `CACornerMask`.
 * @param radius The full radius.
 * @param squared The radius of the corners that do not round; 0 leaves them square.
 * @param tail The side that carries a tail, if any.
 * @returns Each corner's radius.
 */
export function cornerRadii(
	corners: number,
	radius: number,
	squared: number,
	tail?: TailSide,
): Radii {
	const pick = (corner: number, tailed: boolean) =>
		corners & corner ? radius : tailed ? 0 : squared;

	return {
		topLeft: pick(Corner.topLeft, tail === 'top'),
		topRight: pick(Corner.topRight, false),
		bottomRight: pick(Corner.bottomRight, false),
		bottomLeft: pick(Corner.bottomLeft, tail === 'bottom'),
	};
}

export default { bubblePath, cornerRadii };
