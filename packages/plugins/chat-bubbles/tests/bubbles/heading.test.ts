import { describe, expect, test } from 'bun:test';

import { headingPlace, headingRoom } from '~/bubbles/heading';
import type { Heading } from '~/bubbles/message-layout';

const plain: Heading = {
	name: { x: 68, y: 57, width: 346, height: 22 },
	nameWidth: 55,
	time: { x: 126, y: 61, width: 93, height: 16 },
};
const reply: Heading = {
	...plain,
	reply: {
		container: { x: 0, y: 41, width: 430, height: 23 },
		content: { x: 52, y: 43, width: 346, height: 19 },
		label: 9,
		labelX: 74,
	},
};
const bubble = { x: 68, y: 19, width: 250, height: 80 };

describe('heading', () => {
	test('keeps the name where Discord put it without a reply, and fits the name and time', () => {
		expect(headingRoom(plain, 0, 14)).toEqual({ top: 57, minWidth: 14 + 55 + 8 + 93 + 14 });
	});

	test("lifts the name over the reply's preview and its room, and fits the quote's text", () => {
		expect(headingRoom(reply, 300, 14)).toEqual({
			top: 29,
			minWidth: 6 * 2 + 8 * 2 + 22 + 300,
		});
	});

	test("lines the name up with the text and the time with the bubble's right padding", () => {
		const place = headingPlace(plain, bubble, 79, 14);

		expect(place.name).toEqual({ x: 14, y: 0 });
		expect(place.avatar).toEqual({ x: 0, y: 0 });
		// The time's right edge, 68 + 250 - 14, in the moved name row.
		expect(place.time).toEqual({ x: 304 - 93 - 68 - 14, y: 4, width: 93, height: 16 });
		expect(place.reply).toBeUndefined();
	});

	test('puts the reply in a box between the name and the text, clipped to the box', () => {
		const place = headingPlace(reply, bubble, 79, 14);

		expect(place.name).toEqual({ x: 14, y: -28 });
		expect(place.avatar).toEqual({ x: 0, y: -28 });
		expect(place.reply).toEqual({
			box: { x: 74, y: 55, width: 238, height: 20 },
			move: { x: 30, y: 12.5 },
			clip: { x: 44, y: 1.5, width: 230, height: 20 },
		});
	});
});
