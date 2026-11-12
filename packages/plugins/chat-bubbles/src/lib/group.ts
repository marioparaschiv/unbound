import type { Box } from '~/lib/geometry';

export type GroupPosition = {
	start: boolean;
	end: boolean;
};

export type BubbleEdges = GroupPosition & {
	/** Where this bubble's right edge is. */
	right: number;
	/** Where the right edge of the bubble above in the same group is, when known. */
	aboveRight?: number;
	/** Where the right edge of the bubble below in the same group is, when known. */
	belowRight?: number;
};

/** How far a bubble must reach past its neighbour before its corner there is rounded, in points. */
const EXPOSED_MINIMUM = 1;

/** How much edge a continuous (squircle) corner bends over, as a multiple of its radius. */
const CONTINUOUS_EXTENT = 1.528;

export type CornerShape = { radius: number; continuous: boolean };

/**
 * @description Fits the corner radius to a bubble: Apple's continuous curve while two corners fit along each side, otherwise a circular curve capped at half the shorter side, a pill, since a squircle that does not fit draws pointed ends.
 * @param radius The radius asked for.
 * @param width The bubble's width.
 * @param height The bubble's height.
 * @param continuous Whether to prefer the continuous curve; false always draws a circular one.
 * @returns The radius to draw and whether to draw it as a continuous curve.
 */
export function cornerShape(
	radius: number,
	width: number,
	height: number,
	continuous = true,
): CornerShape {
	const side = Math.min(width, height);

	if (continuous && radius * CONTINUOUS_EXTENT * 2 <= side) return { radius, continuous: true };

	return { radius: Math.min(radius, side / 2), continuous: false };
}

/** Core Animation's `CACornerMask` bits, top corners first since UIKit's y grows downwards. */
export const Corner = {
	topLeft: 1,
	topRight: 2,
	bottomLeft: 4,
	bottomRight: 8,
};

/**
 * @description Tells whether a message ends its group from the row below it.
 * @param belowStartsGroup Whether the message below starts a group, or `undefined` when no message row is below or it is not measured yet.
 * @returns True unless the message below continues this one's group.
 */
export function endsGroup(belowStartsGroup: boolean | undefined): boolean {
	return belowStartsGroup !== false;
}

function exposed(right: number, neighbour: number | undefined): boolean {
	return neighbour !== undefined && neighbour < right - EXPOSED_MINIMUM;
}

export type CornerOptions = {
	/** False rounds every corner of every bubble. */
	grouped?: boolean;
	/** False keeps a right corner square even where it reaches past its neighbour. */
	roundExposed?: boolean;
	/** True rounds every right corner, so only the left side squares off where bubbles meet. */
	roundOuter?: boolean;
};

const ALL_CORNERS = Corner.topLeft | Corner.topRight | Corner.bottomLeft | Corner.bottomRight;

/**
 * @description Picks which corners of a message's bubble are rounded: the top ones on the group's first message, the bottom ones on its last, and a right corner wherever the bubble reaches past its neighbour in the group.
 * @param edges Whether the message starts and ends its group, and the right edges of it and its neighbours.
 * @param options Whether bubbles are grouped at all, and whether exposed right corners round.
 * @returns The rounded corners as a `CACornerMask`.
 */
export function bubbleCorners(
	{ start, end, right, aboveRight, belowRight }: BubbleEdges,
	{ grouped = true, roundExposed = true, roundOuter = false }: CornerOptions = {},
): number {
	if (!grouped) return ALL_CORNERS;

	const topLeft = start ? Corner.topLeft : 0;
	const topRight =
		start || roundOuter || (roundExposed && exposed(right, aboveRight)) ? Corner.topRight : 0;
	const bottomLeft = end ? Corner.bottomLeft : 0;
	const bottomRight =
		end || roundOuter || (roundExposed && exposed(right, belowRight)) ? Corner.bottomRight : 0;

	return topLeft | topRight | bottomLeft | bottomRight;
}

/**
 * @description Widens each bubble of a run of touching bubbles to a neighbour that reaches past it by less than the corner radius, since a corner cannot round over so short a step, until no such step is left. It works from the bubbles' own edges, so every bubble of the run gets the same answer.
 * @param rights The right edges of the touching bubbles, top to bottom, before any widening.
 * @param radius The corner radius.
 * @returns The right edges after widening, in the same order.
 */
export function snapRights(rights: number[], radius: number): number[] {
	const snapped = [...rights];

	for (let changed = true; changed;) {
		changed = false;

		for (let index = 1; index < snapped.length; index++) {
			const step = Math.abs(snapped[index]! - snapped[index - 1]!);

			if (step === 0 || step >= radius) continue;

			const widest = Math.max(snapped[index]!, snapped[index - 1]!);

			snapped[index] = widest;
			snapped[index - 1] = widest;
			changed = true;
		}
	}

	return snapped;
}

export type Fillets = { top: number; bottom: number };

/**
 * @description Sizes the inward curves that join a bubble to a wider neighbour it touches, filling the step under the neighbour's rounded corner so the two read as one shape.
 * @param edges Whether the message starts and ends its group, and the right edges of it and its neighbours.
 * @param radius The corner radius; a curve grows to it once the neighbour reaches a radius past the corner it rounds.
 * @returns How big the curve at the top and bottom right is, 0 where there is none.
 */
export function joinFillets(
	{ start, end, right, aboveRight, belowRight }: BubbleEdges,
	radius: number,
): Fillets {
	const fillet = (neighbour: number | undefined) =>
		neighbour === undefined ? 0 : Math.max(0, Math.min(radius, neighbour - right - radius));

	return { top: start ? 0 : fillet(aboveRight), bottom: end ? 0 : fillet(belowRight) };
}

/** Content the bubble must keep its full padding around, such as media, whose edges are visible. */
export type HardEdges = { top: number; bottom: number; padding: number };

/**
 * @description Keeps a bubble inside its row, short of both edges by half the gap, so neighbouring bubbles never overlap, except that it never cuts into the padding around media.
 * @param bubble The bubble's frame in its row.
 * @param height The row's height.
 * @param gap The space to leave between two rows' bubbles.
 * @param hard The top and bottom of the row's media and the padding it keeps, when it has media.
 * @returns The bubble's frame, unchanged where it already fits.
 */
export function separateFrame(bubble: Box, height: number, gap: number, hard?: HardEdges): Box {
	const inside = Math.max(bubble.y, gap / 2);
	const outside = Math.min(bubble.y + bubble.height, height - gap / 2);
	const top = hard ? Math.min(inside, hard.top - hard.padding) : inside;
	const bottom = hard ? Math.max(outside, hard.bottom + hard.padding) : outside;

	if (bottom <= top) return bubble;

	return { ...bubble, y: top, height: bottom - top };
}

/**
 * @description Moves a bubble's top and bottom clear of the bubbles that reach into its row from the rows above and below, keeping the full gap to them.
 * @param bubble The bubble's frame in its row.
 * @param height The row's height.
 * @param gap The space to leave to the bubbles above and below.
 * @param fromAbove How far the bubble above reaches down into this row.
 * @param fromBelow How far the bubble below reaches up into this row.
 * @returns The bubble's frame, unchanged when nothing reaches in or it would leave no bubble.
 */
export function clearNeighbours(
	bubble: Box,
	height: number,
	gap: { above: number; below: number },
	fromAbove: number,
	fromBelow: number,
): Box {
	const top = fromAbove > 0 ? Math.max(bubble.y, fromAbove + gap.above) : bubble.y;
	const bottom =
		fromBelow > 0
			? Math.min(bubble.y + bubble.height, height - fromBelow - gap.below)
			: bubble.y + bubble.height;

	if (bottom <= top) return bubble;

	return { ...bubble, y: top, height: bottom - top };
}

export type TailSide = 'top' | 'bottom';

/**
 * @description Picks where a bubble points a tail at the avatar: the top left of the group's first bubble, or the bottom left of its last.
 * @param position Which bubble of the group gets the tail, if any.
 * @param group Whether the message starts and ends its group.
 * @returns The bubble's side that carries the tail, or `undefined` when it has none.
 */
export function bubbleTail(
	position: 'off' | 'first' | 'last',
	{ start, end }: GroupPosition,
): TailSide | undefined {
	if (position === 'first' && start) return 'top';
	if (position === 'last' && end) return 'bottom';

	return undefined;
}

/**
 * @description Squares the corner a tail grows out of.
 * @param corners The rounded corners as a `CACornerMask`.
 * @param tail The side that carries the tail, if any.
 * @returns The corners without the tail's.
 */
export function withoutTailCorner(corners: number, tail: TailSide | undefined): number {
	if (tail === 'top') return corners & ~Corner.topLeft;
	if (tail === 'bottom') return corners & ~Corner.bottomLeft;

	return corners;
}

/**
 * @description Stretches a bubble towards the edges of its row it shares with the rest of its group, to half the group gap from each, so a group's bubbles sit exactly that far apart. It never shrinks a bubble, so a gap wider than the bubble spacing stops there.
 * @param bubble The bubble's frame in its row.
 * @param height The row's height.
 * @param position Whether the message starts and ends its group.
 * @param gap The space between two bubbles of the group; 0 makes them touch.
 * @returns The frame, stretched at the top unless it starts the group and at the bottom unless it ends it.
 */
export function joinFrame(
	bubble: Box,
	height: number,
	{ start, end }: GroupPosition,
	gap = 0,
): Box {
	const top = start ? bubble.y : Math.min(bubble.y, gap / 2);
	const bottom = end
		? bubble.y + bubble.height
		: Math.max(bubble.y + bubble.height, height - gap / 2);

	return { ...bubble, y: top, height: bottom - top };
}

/**
 * @description Keeps a joined bubble inside its row on the edges it shares with its group, since touching bubbles that overlap draw the overlap twice.
 * @param bubble The bubble's frame in its row.
 * @param height The row's height.
 * @param position Whether the message starts and ends its group.
 * @returns The frame, cut at the top unless it starts the group and at the bottom unless it ends it.
 */
export function clampJoined(bubble: Box, height: number, { start, end }: GroupPosition): Box {
	const top = start ? bubble.y : Math.max(bubble.y, 0);
	const bottom = end ? bubble.y + bubble.height : Math.min(bubble.y + bubble.height, height);

	return { ...bubble, y: top, height: bottom - top };
}

/**
 * @description Measures how far a bubble reaches past the top and bottom of its row.
 * @param bubble The bubble's frame in its row.
 * @param height The row's height.
 * @returns How far it reaches above and below the row, 0 when it stays inside.
 */
export function overflow(bubble: Box, height: number): { above: number; below: number } {
	return {
		above: Math.max(0, -bubble.y),
		below: Math.max(0, bubble.y + bubble.height - height),
	};
}

export default {
	bubbleCorners,
	bubbleTail,
	clampJoined,
	withoutTailCorner,
	clearNeighbours,
	cornerShape,
	endsGroup,
	joinFillets,
	joinFrame,
	snapRights,
	overflow,
	separateFrame,
};
