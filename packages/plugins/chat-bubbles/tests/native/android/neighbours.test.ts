import { describe, expect, test } from 'bun:test';

import { createNeighbours, type GroupStyle } from '~/native/android/neighbours';
import { Corner } from '~/lib/group';
import { Grouping } from '~/lib/constants';

const ALL = Corner.topLeft | Corner.topRight | Corner.bottomLeft | Corner.bottomRight;
const style = (grouping: GroupStyle['grouping']): GroupStyle => ({
	spacing: 4,
	groupSpacing: 2,
	grouping,
	roundExposed: true,
	roundOuter: false,
	joinCurves: true,
	smoothSteps: true,
	radius: 18,
});
const bubble = (width: number) => ({ x: 50, y: 4, width, height: 32 });

describe('android neighbours', () => {
	test('squares the corners where two bubbles of a group meet', () => {
		const neighbours = createNeighbours(
			() => style(Grouping.grouped),
			() => undefined,
		);
		const first = neighbours.fit('a', bubble(200), 40, { start: true, end: false, below: 'b' });
		const last = neighbours.fit('b', bubble(200), 40, { start: false, end: true, above: 'a' });

		expect(first.corners & Corner.bottomLeft).toBe(0);
		expect(first.corners & Corner.topLeft).toBe(Corner.topLeft);
		expect(last.corners & Corner.topLeft).toBe(0);
		expect(last.corners & Corner.bottomLeft).toBe(Corner.bottomLeft);
	});

	test('rounds a right corner that reaches past the bubble next to it', () => {
		const neighbours = createNeighbours(
			() => style(Grouping.grouped),
			() => undefined,
		);

		neighbours.fit('a', bubble(100), 40, { start: true, end: false, below: 'b' });

		const wider = neighbours.fit('b', bubble(200), 40, { start: false, end: true, above: 'a' });

		expect(wider.corners & Corner.topRight).toBe(Corner.topRight);
	});

	test('rounds every corner when bubbles are not grouped', () => {
		const neighbours = createNeighbours(
			() => style(Grouping.separate),
			() => undefined,
		);

		expect(
			neighbours.fit('a', bubble(200), 40, { start: true, end: false, below: 'b' }).corners,
		).toBe(ALL);
	});

	test('places the neighbours again when a bubble changes', () => {
		const redrawn: string[] = [];
		const neighbours = createNeighbours(
			() => style(Grouping.grouped),
			(id) => redrawn.push(id),
		);
		const place = { start: false, end: false, above: 'a', below: 'c' };

		neighbours.fit('b', bubble(200), 40, place);
		expect(redrawn).toEqual(['a', 'c']);

		neighbours.fit('b', bubble(200), 40, place);
		expect(redrawn).toEqual(['a', 'c']);

		neighbours.fit('b', bubble(120), 40, place);
		expect(redrawn).toEqual(['a', 'c', 'a', 'c']);
	});
});
