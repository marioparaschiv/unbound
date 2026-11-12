import { describe, expect, test } from 'bun:test';

import { cellFallback, cellPaint } from '~/lib/cell-paint';
import type { Heading } from '~/lib/message-layout';
import { bubbleAppearance } from '~/lib/style';
import { Quote } from '~/lib/constants';

const heading: Heading = {
	name: { x: 68, y: 57, width: 346, height: 22 },
	nameWidth: 55,
	reply: {
		container: { x: 0, y: 41, width: 430, height: 23 },
		content: { x: 52, y: 43, width: 346, height: 19 },
		label: 9,
		labelX: 74,
	},
};
const bubble = { x: 68, y: 19, width: 250, height: 80 };
const color = { red: 0.5, green: 0.5, blue: 0.5, alpha: 0.9 };
const padding = { horizontal: 14, vertical: 10 };
const NO_MOVES = { name: { x: 0, y: 0 }, avatar: { x: 0, y: 0 }, reply: { x: 0, y: 0 } };
const appearance = (values: Record<string, unknown>) =>
	bubbleAppearance((key) => values[key], { red: 0, green: 0, blue: 0 });

describe('cell paint', () => {
	test('lifts the name, avatar and reply when they sit outside the bubble', () => {
		const up = { x: 0, y: -10 };
		const moves = { name: up, avatar: up, reply: up };
		const measured = {
			heading,
			bodyTop: 79,
			inside: false,
			quoted: false,
			keepTime: false,
			lifted: 10,
			moves,
		};
		const picture = { author: 'c/low', start: true, end: false };

		expect(cellPaint(measured, bubble, padding, color, picture)).toEqual({
			name: { x: 0, y: -10 },
			avatar: { x: 0, y: -10 },
			reply: { x: 0, y: -10 },
			picture,
		});
	});

	test("draws the quote box in the bubble's own coordinates, shaded from the bubble", () => {
		const paint = cellPaint(
			{
				heading,
				bodyTop: 79,
				inside: true,
				quoted: true,
				keepTime: false,
				lifted: 0,
				moves: NO_MOVES,
			},
			bubble,
			padding,
			color,
			undefined,
		);

		expect(paint.reply).toEqual({ x: 30, y: 12.5 });
		expect(paint.quote).toMatchObject({
			box: { x: Quote.inset, y: 36, width: 238, height: 20 },
			radius: Quote.radius,
		});
		expect(paint.quote?.color.alpha).toBe(0.9);
		expect(paint.quote?.color.red).toBeCloseTo(0.5 - Quote.shade);
		expect(paint.picture).toBeUndefined();
	});

	test('lays an unmeasured first row out like a measured one', () => {
		expect(cellFallback(appearance({ avatarLast: true }))).toEqual({
			name: { x: 14, y: 0 },
			avatar: { x: 0, y: 0 },
			reply: { x: 0, y: 0 },
			hideStart: true,
		});
		expect(cellFallback(appearance({ nameInside: false })).name).toEqual({ x: 0, y: -10 });
		expect(cellFallback(appearance({ layout: 'card' }))).toMatchObject({
			name: { x: 5, y: 0 },
			reply: { x: 0, y: -6 },
		});
	});
});
