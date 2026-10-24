import { describe, expect, test } from 'bun:test';

import {
	framesMatch,
	reactionAvatarFrame,
	reactionBaseViewWidth,
	reflowReactionItems,
	type LayoutFrame,
} from './layout';
import { reactionAvatarReservedExtraWidth } from './avatars';

describe('framesMatch', () => {
	test('detects when native layout replaces an expanded reaction cell frame', () => {
		const expanded = { height: 34, width: 67.5, x: 0, y: 0 };
		const restored = { height: 34, width: 49.5, x: 0, y: 0 };

		expect(framesMatch(expanded, expanded)).toBe(true);
		expect(framesMatch(restored, expanded)).toBe(false);
		expect(framesMatch(undefined, expanded)).toBe(false);
	});
});

describe('reactionBaseViewWidth', () => {
	test('recovers the original reaction view width after native cell reuse', () => {
		expect(reactionBaseViewWidth(47.5, 47.5, 43.5)).toBe(43.5);
		expect(reactionBaseViewWidth(47.5, 65.5, 61.5)).toBe(43.5);
		expect(reactionBaseViewWidth(47.5, 83.5, 79.5)).toBe(43.5);
	});
});

describe('reactionAvatarFrame', () => {
	test('places the avatar surface after the reaction pill instead of over it', () => {
		expect(reactionAvatarFrame({ width: 54, x: 0 }, 80)).toEqual({ x: 54, width: 80 });
		expect(reactionAvatarFrame({ width: 54, x: 12 }, 80)).toEqual({ x: 66, width: 80 });
		expect(reactionAvatarFrame({ width: 54, x: 0 }, 80, 4)).toEqual({ x: 50, width: 80 });
	});
});

describe('reflowReactionItems', () => {
	test('reflows expanded reaction pills before they overlap neighboring pills', () => {
		const frames = reflowReactionItems(
			[
				{ height: 34, index: 2, width: 70, x: 140, y: 0 },
				{ extraWidth: 60, height: 34, index: 1, width: 70, x: 70, y: 0 },
				{ height: 34, index: 0, width: 70, x: 0, y: 0 },
				{ height: 34, index: 3, width: 70, x: 0, y: 34 },
			],
			220,
		);

		expect(frames).toEqual([
			{ height: 34, index: 0, width: 70, x: 0, y: 0 },
			{ height: 34, index: 1, width: 130, x: 70, y: 0 },
			{ height: 34, index: 2, width: 70, x: 0, y: 34 },
			{ height: 34, index: 3, width: 70, x: 70, y: 34 },
		]);
	});

	test('keeps the add-reaction cell after the widened final reaction pill', () => {
		const frames = reflowReactionItems(
			[
				{ extraWidth: 18, height: 34, index: 0, width: 49.5, x: 0, y: 0 },
				{ height: 34, index: 1, width: 38, x: 49.5, y: 0 },
			],
			291,
		);

		expect(frames).toEqual([
			{ height: 34, index: 0, width: 67.5, x: 0, y: 0 },
			{ height: 34, index: 1, width: 38, x: 67.5, y: 0 },
		]);
	});

	test('keeps the add-reaction cell clear when a message gets its first reaction', () => {
		const frames = reflowReactionItems(
			[
				{
					extraWidth: reactionAvatarReservedExtraWidth(1),
					height: 34,
					index: 0,
					width: 49.5,
					x: 0,
					y: 0,
				},
				{ height: 34, index: 1, width: 34, x: 49.5, y: 0 },
			],
			291,
		);

		expect(frames[0].width).toBe(67.5);
		expect(frames[1].x).toBe(67.5);
	});

	test('reflows a twenty-reaction stress grid with avatar stacks inside the viewport width', () => {
		const frames = reflowReactionItems(
			Array.from({ length: 20 }, (_, index) => ({
				extraWidth: 47,
				height: 30,
				index,
				width: 70,
				x: (index % 5) * 76,
				y: Math.floor(index / 5) * 38,
			})),
			350,
		);
		const rows = new Map<number, LayoutFrame[]>();

		for (const frame of frames) {
			rows.set(frame.y, [...(rows.get(frame.y) ?? []), frame]);
			expect(frame.x + frame.width).toBeLessThanOrEqual(350);
		}

		expect(frames).toHaveLength(20);
		expect(rows.size).toBe(10);

		for (const row of rows.values()) {
			for (let index = 1; index < row.length; index++) {
				expect(row[index - 1].x + row[index - 1].width).toBeLessThanOrEqual(row[index].x);
			}
		}
	});
});
