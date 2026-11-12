import { describe, expect, test } from 'bun:test';

import {
	argb,
	bubbleAppearance,
	bubbleLayout,
	parseHexColor,
	rowInset,
	rowRooms,
} from '~/bubbles/style';

const reader = (values: Record<string, unknown>) => (key: string) => values[key];
const dark = { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255 };

describe('bubble style', () => {
	test('uses the loader style by default, in the theme color', () => {
		expect(bubbleAppearance(reader({}), dark)).toEqual({
			layout: 'dynamic',
			radius: 16,
			horizontalPadding: 14,
			verticalPadding: 10,
			spacing: 6,
			mediaCorners: 'none',
			cornerCurve: 'continuous',
			grouping: 'grouped',
			roundExposed: true,
			roundOuter: true,
			groupSpacing: 4,
			joinCurves: true,
			smoothSteps: true,
			roomyRows: true,
			avatarLast: false,
			nameInside: true,
			tail: 'off',
			tailSize: 8,
			color: { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255, alpha: 1 },
			ownColor: { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255, alpha: 1 },
			mention: { color: undefined, alpha: 0.4, width: 0.5, tint: 0.12 },
		});
		expect(
			bubbleAppearance(reader({ opacity: 50 }), { red: 1, green: 1, blue: 1 }).color,
		).toEqual({ red: 1, green: 1, blue: 1, alpha: 0.5 });
	});

	test('reads custom values, clamped to their limits', () => {
		const appearance = bubbleAppearance(
			reader({
				radius: 99,
				horizontalPadding: '12',
				verticalPadding: -2,
				spacing: 40,
				opacity: 75,
				color: '#f80',
			}),
			dark,
		);

		expect(appearance.radius).toBe(32);
		expect(appearance.horizontalPadding).toBe(12);
		expect(appearance.verticalPadding).toBe(0);
		expect(appearance.spacing).toBe(16);
		expect(appearance.color).toEqual({ red: 1, green: 136 / 255, blue: 0, alpha: 0.75 });
	});

	test('points the tail from the bubble beside the avatar', () => {
		const tail = (values: Record<string, unknown>) =>
			bubbleAppearance(reader(values), dark).tail;

		expect(tail({ tail: true })).toBe('first');
		expect(tail({ tail: true, avatarLast: true })).toBe('last');
		expect(tail({ tail: false, avatarLast: true })).toBe('off');
	});

	test("uses its own color for the user's messages, falling back to the bubble color", () => {
		const custom = bubbleAppearance(
			reader({ color: '#000', ownColor: '#5865f2', opacity: 50 }),
			dark,
		);

		expect(custom.ownColor).toEqual({
			red: 88 / 255,
			green: 101 / 255,
			blue: 242 / 255,
			alpha: 0.5,
		});
		expect(
			bubbleAppearance(reader({ color: '#f80', ownColor: 'blue' }), dark).ownColor,
		).toEqual({ red: 1, green: 136 / 255, blue: 0, alpha: 1 });
	});

	test('reads the mention color, opacity, tint and a width in quarter points', () => {
		expect(
			bubbleAppearance(
				reader({
					mentionColor: '#00f',
					mentionOpacity: 80,
					mentionTint: 0,
					mentionWidth: 1.3,
				}),
				dark,
			).mention,
		).toEqual({ color: { red: 0, green: 0, blue: 1 }, alpha: 0.8, width: 1.25, tint: 0 });
		expect(bubbleAppearance(reader({ mentionWidth: 9 }), dark).mention.width).toBe(3);
	});

	test('reads the layout, falling back to bubbles that fit the content', () => {
		expect(bubbleAppearance(reader({ layout: 'card' }), dark).layout).toBe('card');
		expect(bubbleLayout('dynamic')).toBe('dynamic');
		expect(bubbleLayout('grid')).toBe('dynamic');
		expect(bubbleLayout(undefined)).toBe('dynamic');
	});

	test('ignores colors that are not hex', () => {
		expect(parseHexColor('purple')).toBeUndefined();
		expect(parseHexColor('#12345')).toBeUndefined();
		expect(parseHexColor('0a0B0c')).toEqual({ red: 10 / 255, green: 11 / 255, blue: 12 / 255 });
	});

	test('packs translucent black and white into ARGB', () => {
		expect(argb({ red: 0, green: 0, blue: 0, alpha: 0.4 })).toBe(0x66000000);
		expect(argb({ red: 1, green: 1, blue: 1, alpha: 0.4 })).toBe(0x66ffffff);
	});

	test('insets fitted content by the horizontal padding, only when rows make room', () => {
		const fitted = bubbleAppearance(reader({ horizontalPadding: 14 }), dark);

		expect(rowInset(fitted)).toBe(14);
		expect(rowInset({ ...fitted, roomyRows: false })).toBe(0);
		expect(rowInset({ ...fitted, layout: 'card' })).toBe(5);
		expect(rowInset({ ...fitted, layout: 'card', roomyRows: false })).toBe(0);
	});

	test('grows every row by the padding on both sides and the spacing', () => {
		const fitted = bubbleAppearance(reader({ verticalPadding: 10, spacing: 6 }), dark);
		const even = { top: 13, bottom: 13 };

		expect(rowRooms(fitted)).toEqual({
			first: even,
			next: even,
			reply: { top: 25, bottom: 13 },
		});
		expect(rowRooms({ ...fitted, nameInside: false }).reply).toEqual(even);
		expect(rowRooms({ ...fitted, layout: 'card' })).toEqual({
			first: { top: 9, bottom: 9 },
			next: { top: 9, bottom: 9 },
			reply: { top: 9, bottom: 9 },
		});
		expect(rowRooms({ ...fitted, roomyRows: false })).toEqual({
			first: { top: 0, bottom: 0 },
			next: { top: 0, bottom: 0 },
			reply: { top: 0, bottom: 0 },
		});
	});

	test('keeps joined rows close, giving the first row the room for the last bubble above too', () => {
		const joined = bubbleAppearance(
			reader({ verticalPadding: 10, spacing: 6, grouping: 'joined' }),
			dark,
		);

		expect(rowRooms(joined)).toEqual({
			first: { top: 22, bottom: 4 },
			next: { top: 4, bottom: 4 },
			reply: { top: 34, bottom: 4 },
		});
		expect(rowRooms({ ...joined, verticalPadding: 0, spacing: 0, nameInside: false })).toEqual({
			first: { top: 0, bottom: 0 },
			next: { top: 0, bottom: 0 },
			reply: { top: 0, bottom: 0 },
		});
	});
});
