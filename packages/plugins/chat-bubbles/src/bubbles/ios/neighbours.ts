import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import type { Box } from '~/bubbles/geometry';
import type { BubbleAppearance } from '~/bubbles/style';
import { Grouping, IOSClass } from '~/constants';
import {
	bubbleCorners,
	clampJoined,
	clearNeighbours,
	endsGroup,
	joinFillets,
	joinFrame,
	overflow,
	snapRights,
} from '~/bubbles/group';

type GroupStyle = Pick<
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

type AdjacentCells = { above?: NativeObjectHandle; below?: NativeObjectHandle };

type Reach = { fromAbove: number; fromBelow: number };

/** A `CGAffineTransform` as the bridge returns it, plain or boxed in an `NSValue`. */
type BoxedTransform = { d?: number; value?: { d?: number } };

/**
 * @description Tracks each message cell's bubble against the rows above and below it, so bubbles round by their place in a group and keep clear of each other.
 * @param objc The Objective-C bridge.
 * @param style Reads the gap to keep between two rows' bubbles and how a group's bubbles meet.
 * @param redraw Places a neighbouring cell again, after this cell changed what it depends on.
 * @returns `fit`, which fits a measured bubble to its neighbours, `cleared`, the frame a cell's bubble should have now, and `forget` and `clear`.
 */
export function createNeighbours(
	objc: NativeObjCBridge,
	style: () => GroupStyle,
	redraw: (cell: NativeObjectHandle, key: string) => void,
) {
	const IndexPath = objc.getClass('NSIndexPath');
	const starts = new Map<string, boolean>();
	const ends = new Map<string, boolean>();
	const rights = new Map<string, number>();
	const overflows = new Map<string, { above: number; below: number }>();
	const reaches = new Map<string, Reach>();
	// How far each bubble widens to meet a touching neighbour, so `cleared` gives the frame `fit` drew.
	const widened = new Map<string, number>();
	// Each bubble's right edge before widening, and the touching bubbles of its group, so a run of bubbles widens as one.
	const ownRights = new Map<string, number>();
	const links = new Map<string, { above?: string; below?: string }>();

	// The measured bubbles touching this one in its group, top to bottom; a stale link after reuse cannot loop it.
	function runAround(key: string): string[] {
		const run = [key];
		const seen = new Set(run);

		for (let next = links.get(key)?.above; next && ownRights.has(next) && !seen.has(next);) {
			run.unshift(next);
			seen.add(next);
			next = starts.get(next) ? undefined : links.get(next)?.above;
		}

		for (let next = links.get(key)?.below; next && ownRights.has(next) && !seen.has(next);) {
			run.push(next);
			seen.add(next);
			next = ends.get(next) ? undefined : links.get(next)?.below;
		}

		return run;
	}

	// Discord flips its chat table upside down, newest row first, so the row index runs against the screen.
	async function adjacentCells(cell: NativeObjectHandle): Promise<AdjacentCells> {
		const table = (await objc.invokeAsync(cell, 'superview', [])) as NativeObjectHandle | null;

		if (!IndexPath || !table || !objc.respondsTo(table, 'indexPathForCell:')) return {};

		const path = (await objc.invokeAsync(table, 'indexPathForCell:', [
			cell,
		])) as NativeObjectHandle | null;

		if (!path) return {};

		// NSInteger comes back as a string and goes in as a BigInt, so 64-bit values survive.
		const [rowValue, section, transform] = (await objc.batch([
			{ target: path, selector: 'row', args: [] },
			{ target: path, selector: 'section', args: [] },
			{ target: table, selector: 'transform', args: [] },
		])) as [string, string, BoxedTransform | null];
		const row = Number(rowValue);
		const down = ((transform?.value ?? transform)?.d ?? 1) < 0 ? -1 : 1;
		const at = (offset: number) => ({
			target: table,
			selector: 'cellForRowAtIndexPath:',
			args: [
				objc.call(
					IndexPath,
					'indexPathForRow:inSection:',
					BigInt(row + offset),
					BigInt(section),
				),
			],
		});
		const offsets = [-down, down].filter((offset) => row + offset >= 0);
		const found = (await objc.batch(offsets.map(at))) as (NativeObjectHandle | null)[];
		// A date separator has no bubble, so it neither joins a group nor needs placing again.
		const cellAt = (offset: number) => {
			const cell = found[offsets.indexOf(offset)];

			return cell && objc.className(cell) === IOSClass.messageCell ? cell : undefined;
		};

		return { above: cellAt(-down), below: cellAt(down) };
	}

	// Joining first lets clearing still keep a joined bubble out of a neighbour's overflowing media.
	// A bubble stretches to meet the next one of its group only down to `stretchTo`, such as the top of its reactions.
	function separated(key: string, measured: Box, height: number, stretchTo: number): Box {
		const { spacing, groupSpacing, grouping } = style();
		// Joined groups always touch, whatever spacing inside groups is set to.
		const inside = grouping === Grouping.joined ? 0 : groupSpacing;
		const start = starts.get(key) ?? true;
		const end = ends.get(key) ?? true;
		const stretched = joinFrame(measured, stretchTo, { start, end }, inside);
		const joined =
			grouping === Grouping.joined
				? clampJoined(stretched, height, { start, end })
				: stretched;
		const reach = reaches.get(key);
		const gap = {
			above: start ? spacing : inside,
			below: end ? spacing : inside,
		};

		return reach
			? clearNeighbours(joined, height, gap, reach.fromAbove, reach.fromBelow)
			: joined;
	}

	function cleared(key: string, measured: Box, height: number, stretchTo = height): Box {
		const frame = separated(key, measured, height, stretchTo);

		return { ...frame, width: frame.width + (widened.get(key) ?? 0) };
	}

	async function fit(
		key: string,
		cell: NativeObjectHandle,
		measured: Box,
		height: number,
		place: { start: boolean; end?: boolean },
		stretchTo = height,
	) {
		const { start } = place;
		const { above, below } = await adjacentCells(cell).catch((): AdjacentCells => ({}));
		const belowKey = below && viewKey(objc, below);
		const aboveKey = above && viewKey(objc, above);

		reaches.set(key, {
			fromAbove: (aboveKey !== undefined && overflows.get(aboveKey)?.below) || 0,
			fromBelow: (belowKey !== undefined && overflows.get(belowKey)?.above) || 0,
		});

		// Without the channel's data, a row below that is not placed yet ends the group.
		const end =
			place.end ?? endsGroup(belowKey === undefined ? undefined : starts.get(belowKey));
		const placeChanged = starts.get(key) !== start || ends.get(key) !== end;

		starts.set(key, start);
		ends.set(key, end);

		const { grouping, roundExposed, roundOuter, joinCurves, smoothSteps, radius } = style();
		const grouped = grouping !== Grouping.separate;
		const joined = grouping === Grouping.joined;
		const own = separated(key, measured, height, stretchTo);
		const ownRight = Math.round(own.x + own.width);
		const ownChanged = ownRights.get(key) !== ownRight;

		ownRights.set(key, ownRight);
		links.set(key, { above: start ? undefined : aboveKey, below: end ? undefined : belowKey });

		const run = runAround(key);
		const runRights = run.map((member) => ownRights.get(member)!);
		const snapped = joined && smoothSteps ? snapRights(runRights, radius) : runRights;
		const at = run.indexOf(key);
		const right = snapped[at]!;
		const aboveRight = snapped[at - 1];
		const belowRight = snapped[at + 1];

		widened.set(key, right - ownRight);

		const frame = cleared(key, measured, height, stretchTo);
		const reach = overflow(frame, height);
		const previous = overflows.get(key);
		const changed =
			placeChanged ||
			ownChanged ||
			rights.get(key) !== right ||
			previous?.above !== reach.above ||
			previous?.below !== reach.below;

		rights.set(key, right);
		overflows.set(key, reach);

		if (changed) {
			if (above && aboveKey !== undefined) redraw(above, aboveKey);
			if (below && belowKey !== undefined) redraw(below, belowKey);
		}

		const edges = { start, end, right, aboveRight, belowRight };
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

		return { frame, corners, start, end, fillets };
	}

	return {
		fit,
		cleared,
		forget(key: string) {
			starts.delete(key);
			ends.delete(key);
			rights.delete(key);
			overflows.delete(key);
			reaches.delete(key);
			widened.delete(key);
			ownRights.delete(key);
			links.delete(key);
		},
		clear() {
			starts.clear();
			ends.clear();
			rights.clear();
			overflows.clear();
			reaches.clear();
			widened.clear();
			ownRights.clear();
			links.clear();
		},
	};
}

export default { createNeighbours };
