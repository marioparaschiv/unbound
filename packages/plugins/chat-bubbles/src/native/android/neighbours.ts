import type { Box } from '~/lib/geometry';
import type { BubbleAppearance } from '~/lib/style';
import { Grouping } from '~/lib/constants';
import {
	bubbleCorners,
	clampJoined,
	clearNeighbours,
	joinFillets,
	joinFrame,
	overflow,
	snapRights,
	type Fillets,
} from '~/lib/group';

export type GroupStyle = Pick<
	BubbleAppearance,
	| 'spacing'
	| 'groupSpacing'
	| 'grouping'
	| 'roundExposed'
	| 'roundOuter'
	| 'joinCurves'
	| 'smoothSteps'
	| 'radius'
>;

/** A message's place in its group and the messages in the rows next to it. */
export type RowPlace = {
	start: boolean;
	end: boolean;
	above?: string;
	below?: string;
};

export type Fitted = { frame: Box; corners: number; fillets: Fillets };

type Reach = { fromAbove: number; fromBelow: number };

/**
 * @description Tracks each message's bubble against the messages above and below it, by message id, so bubbles round by their place in a group and keep clear of each other.
 * @param style Reads the gap to keep between two rows' bubbles and how a group's bubbles meet.
 * @param redraw Places a neighbouring message again, after this one changed what it depends on.
 * @returns `fit`, which fits a measured bubble to its neighbours, and `forget` and `clear`.
 */
export function createNeighbours(style: () => GroupStyle, redraw: (id: string) => void) {
	const places = new Map<string, RowPlace>();
	const rights = new Map<string, number>();
	const ownRights = new Map<string, number>();
	const overflows = new Map<string, { above: number; below: number }>();
	const reaches = new Map<string, Reach>();

	// The measured bubbles touching this one in its group, top to bottom.
	function runAround(id: string): string[] {
		const run = [id];
		const seen = new Set(run);

		for (let next = links(id).above; next && ownRights.has(next) && !seen.has(next);) {
			run.unshift(next);
			seen.add(next);
			next = links(next).above;
		}

		for (let next = links(id).below; next && ownRights.has(next) && !seen.has(next);) {
			run.push(next);
			seen.add(next);
			next = links(next).below;
		}

		return run;
	}

	function links(id: string): { above?: string; below?: string } {
		const place = places.get(id);

		if (!place) return {};

		return {
			above: place.start ? undefined : place.above,
			below: place.end ? undefined : place.below,
		};
	}

	function separated(id: string, measured: Box, height: number): Box {
		const { spacing, groupSpacing, grouping } = style();
		const inside = grouping === Grouping.joined ? 0 : groupSpacing;
		const { start, end } = places.get(id) ?? { start: true, end: true };
		const stretched = joinFrame(measured, height, { start, end }, inside);
		const joined =
			grouping === Grouping.joined
				? clampJoined(stretched, height, { start, end })
				: stretched;
		const reach = reaches.get(id);
		const gap = { above: start ? spacing : inside, below: end ? spacing : inside };

		return reach
			? clearNeighbours(joined, height, gap, reach.fromAbove, reach.fromBelow)
			: joined;
	}

	function fit(id: string, measured: Box, height: number, place: RowPlace): Fitted {
		const previousPlace = places.get(id);

		places.set(id, place);
		reaches.set(id, {
			fromAbove: (place.above && overflows.get(place.above)?.below) || 0,
			fromBelow: (place.below && overflows.get(place.below)?.above) || 0,
		});

		const { grouping, roundExposed, roundOuter, joinCurves, smoothSteps, radius } = style();
		const grouped = grouping !== Grouping.separate;
		const joined = grouping === Grouping.joined;
		const own = separated(id, measured, height);
		const ownRight = Math.round(own.x + own.width);
		const ownChanged = ownRights.get(id) !== ownRight;

		ownRights.set(id, ownRight);

		const run = runAround(id);
		const runRights = run.map((member) => ownRights.get(member)!);
		const snapped = joined && smoothSteps ? snapRights(runRights, radius) : runRights;
		const at = run.indexOf(id);
		const right = snapped[at]!;
		const aboveRight = snapped[at - 1];
		const belowRight = snapped[at + 1];
		const frame = { ...own, width: own.width + (right - ownRight) };
		const reach = overflow(frame, height);
		const previous = overflows.get(id);
		const changed =
			previousPlace?.start !== place.start ||
			previousPlace?.end !== place.end ||
			ownChanged ||
			rights.get(id) !== right ||
			previous?.above !== reach.above ||
			previous?.below !== reach.below;

		rights.set(id, right);
		overflows.set(id, reach);

		if (changed) {
			if (place.above) redraw(place.above);
			if (place.below) redraw(place.below);
		}

		const edges = { start: place.start, end: place.end, right, aboveRight, belowRight };
		// Joined bubbles touch, so only a gap between them leaves an outer corner to round.
		const corners = bubbleCorners(edges, {
			grouped,
			roundExposed,
			roundOuter: roundOuter && !joined,
		});
		const fillets =
			joined && joinCurves && roundExposed
				? joinFillets(edges, radius)
				: { top: 0, bottom: 0 };

		return { frame, corners, fillets };
	}

	function forget(id: string) {
		places.delete(id);
		rights.delete(id);
		ownRights.delete(id);
		overflows.delete(id);
		reaches.delete(id);
	}

	return {
		fit,
		forget,
		clear() {
			places.clear();
			rights.clear();
			ownRights.clear();
			overflows.clear();
			reaches.clear();
		},
	};
}

export default { createNeighbours };
