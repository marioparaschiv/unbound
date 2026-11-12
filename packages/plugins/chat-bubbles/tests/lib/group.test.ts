import { describe, expect, test } from 'bun:test';

import {
	bubbleCorners,
	bubbleTail,
	clearNeighbours,
	Corner,
	cornerShape,
	endsGroup,
	joinFillets,
	joinFrame,
	clampJoined,
	overflow,
	snapRights,
	separateFrame,
	withoutTailCorner,
} from '~/lib/group';

const top = Corner.topLeft | Corner.topRight;
const bottom = Corner.bottomLeft | Corner.bottomRight;

describe('endsGroup', () => {
	test('ends the group when the message below starts its own', () => {
		expect(endsGroup(true)).toBe(true);
	});

	test('keeps the group open when the message below continues it', () => {
		expect(endsGroup(false)).toBe(false);
	});

	test('ends the group when no measured message is below', () => {
		expect(endsGroup(undefined)).toBe(true);
	});
});

describe('bubbleCorners', () => {
	test('rounds every corner of a message alone in its group', () => {
		expect(bubbleCorners({ start: true, end: true, right: 100 })).toBe(top | bottom);
	});

	test('rounds only the top of the first message', () => {
		expect(bubbleCorners({ start: true, end: false, right: 100, belowRight: 100 })).toBe(top);
	});

	test('squares off a middle message as wide as its neighbours', () => {
		expect(
			bubbleCorners({
				start: false,
				end: false,
				right: 100,
				aboveRight: 100,
				belowRight: 100,
			}),
		).toBe(0);
	});

	test('rounds only the bottom of the last message', () => {
		expect(bubbleCorners({ start: false, end: true, right: 100, aboveRight: 100 })).toBe(
			bottom,
		);
	});

	test('rounds the top right of a message wider than the one above', () => {
		expect(bubbleCorners({ start: false, end: true, right: 100, aboveRight: 60 })).toBe(
			bottom | Corner.topRight,
		);
	});

	test('rounds the bottom right of a message wider than the one below', () => {
		expect(bubbleCorners({ start: true, end: false, right: 100, belowRight: 60 })).toBe(
			top | Corner.bottomRight,
		);
	});

	test('rounds every right corner with the outer side round, squaring only the left', () => {
		const edges = { start: false, end: false, right: 100, aboveRight: 140, belowRight: 140 };

		expect(bubbleCorners(edges, { roundOuter: true })).toBe(
			Corner.topRight | Corner.bottomRight,
		);
	});

	test('keeps a corner square when the neighbour is wider or about as wide', () => {
		expect(
			bubbleCorners({
				start: false,
				end: false,
				right: 100,
				aboveRight: 140,
				belowRight: 99.5,
			}),
		).toBe(0);
	});

	test('rounds every corner when bubbles are not grouped', () => {
		expect(bubbleCorners({ start: false, end: false, right: 100 }, { grouped: false })).toBe(
			top | bottom,
		);
	});

	test('keeps an exposed corner square when asked to', () => {
		expect(
			bubbleCorners(
				{ start: false, end: true, right: 100, aboveRight: 60 },
				{ roundExposed: false },
			),
		).toBe(bottom);
	});
});

describe('cornerShape', () => {
	test('draws a continuous curve while two corners fit along each side', () => {
		expect(cornerShape(10, 100, 40)).toEqual({ radius: 10, continuous: true });
	});

	test('falls back to a circular pill when a continuous curve does not fit', () => {
		expect(cornerShape(18, 100, 24)).toEqual({ radius: 12, continuous: false });
	});

	test('draws a circular curve when asked to, even where a continuous one fits', () => {
		expect(cornerShape(10, 100, 40, false)).toEqual({ radius: 10, continuous: false });
	});
});

describe('snapRights', () => {
	test('widens a bubble to a neighbour less than a radius past it', () => {
		expect(snapRights([104, 100, 110], 16)).toEqual([110, 110, 110]);
		expect(snapRights([130, 100], 16)).toEqual([130, 100]);
		expect(snapRights([90, 100], 16)).toEqual([100, 100]);
	});

	test('keeps widening while a widened bubble leaves a short step to the next', () => {
		expect(snapRights([129, 109, 121], 16)).toEqual([129, 129, 129]);
	});

	test('leaves steps of a radius or more alone', () => {
		expect(snapRights([129, 109, 109], 16)).toEqual([129, 109, 109]);
	});
});

describe('joinFillets', () => {
	test('curves into a wider neighbour, growing to the radius once it clears the corner', () => {
		const edges = { start: false, end: false, right: 100, aboveRight: 140, belowRight: 120 };

		expect(joinFillets(edges, 16)).toEqual({ top: 16, bottom: 4 });
	});

	test('leaves the group ends and narrower neighbours straight', () => {
		const edges = { start: true, end: false, right: 100, aboveRight: 140, belowRight: 90 };

		expect(joinFillets(edges, 16)).toEqual({ top: 0, bottom: 0 });
	});
});

describe('joinFrame', () => {
	const bubble = { x: 10, y: 4, width: 50, height: 16 };

	test('stretches a middle bubble to both edges of its row', () => {
		expect(joinFrame(bubble, 24, { start: false, end: false })).toEqual({
			...bubble,
			y: 0,
			height: 24,
		});
	});

	test('keeps the top of the first bubble and the bottom of the last', () => {
		expect(joinFrame(bubble, 24, { start: true, end: false })).toEqual({
			...bubble,
			height: 20,
		});
		expect(joinFrame(bubble, 24, { start: false, end: true })).toEqual({
			...bubble,
			y: 0,
			height: 20,
		});
	});

	test('leaves half the group gap to each shared edge', () => {
		expect(joinFrame(bubble, 24, { start: false, end: false }, 2)).toEqual({
			...bubble,
			y: 1,
			height: 22,
		});
		expect(joinFrame(bubble, 24, { start: false, end: false }, 12)).toEqual(bubble);
	});

	test('never shrinks a bubble that already overflows its row', () => {
		const tall = { x: 10, y: -6, width: 50, height: 36 };

		expect(joinFrame(tall, 24, { start: false, end: false })).toEqual(tall);
	});
});

describe('clampJoined', () => {
	const tall = { x: 10, y: -6, width: 50, height: 36 };

	test('keeps a bubble inside its row where it touches the rest of its group', () => {
		expect(clampJoined(tall, 24, { start: false, end: false })).toEqual({
			...tall,
			y: 0,
			height: 24,
		});
	});

	test('lets the first bubble reach up and the last hang down', () => {
		expect(clampJoined(tall, 24, { start: true, end: true })).toEqual(tall);
		expect(clampJoined(tall, 24, { start: true, end: false })).toEqual({ ...tall, height: 30 });
	});
});

describe('clearNeighbours', () => {
	const bubble = { x: 10, y: 0, width: 50, height: 24 };

	test('keeps each gap to the bubbles reaching in', () => {
		expect(clearNeighbours(bubble, 24, { above: 2, below: 0 }, 4, 3)).toEqual({
			...bubble,
			y: 6,
			height: 15,
		});
	});

	test('leaves the bubble alone when nothing reaches in', () => {
		expect(clearNeighbours(bubble, 24, { above: 2, below: 2 }, 0, 0)).toEqual(bubble);
	});
});

describe('overflow', () => {
	test('measures how far a bubble reaches past its row', () => {
		expect(overflow({ x: 0, y: -3, width: 10, height: 30 }, 24)).toEqual({
			above: 3,
			below: 3,
		});
	});
});

describe('bubbleTail', () => {
	test('puts the tail at the top of the first bubble', () => {
		expect(bubbleTail('first', { start: true, end: false })).toBe('top');
		expect(bubbleTail('first', { start: false, end: true })).toBeUndefined();
	});

	test('puts the tail at the bottom of the last bubble', () => {
		expect(bubbleTail('last', { start: false, end: true })).toBe('bottom');
		expect(bubbleTail('last', { start: true, end: false })).toBeUndefined();
	});

	test('draws no tail when it is off', () => {
		expect(bubbleTail('off', { start: true, end: true })).toBeUndefined();
	});

	test('squares the corner the tail grows from', () => {
		expect(withoutTailCorner(top | bottom, 'top')).toBe(Corner.topRight | bottom);
		expect(withoutTailCorner(top | bottom, 'bottom')).toBe(top | Corner.bottomRight);
		expect(withoutTailCorner(top, undefined)).toBe(top);
	});
});

describe('separateFrame', () => {
	test('pulls a bubble that overflows its row back inside, short of both edges', () => {
		expect(separateFrame({ x: 10, y: -4, width: 50, height: 32 }, 24, 2)).toEqual({
			x: 10,
			y: 1,
			width: 50,
			height: 22,
		});
	});

	test('leaves a bubble that already fits alone', () => {
		const bubble = { x: 10, y: 4, width: 50, height: 16 };

		expect(separateFrame(bubble, 24, 2)).toEqual(bubble);
	});

	test('keeps the bubble when the row is too short to hold it', () => {
		const bubble = { x: 10, y: 4, width: 50, height: 16 };

		expect(separateFrame(bubble, 1, 2)).toEqual(bubble);
	});
});
