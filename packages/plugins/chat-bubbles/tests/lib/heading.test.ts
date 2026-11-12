import { describe, expect, test } from 'bun:test';

import { headingPlace, headingRoom, headingSpot, quotedCard } from '~/lib/heading';
import type { Heading } from '~/lib/message-layout';
import { bubbleAppearance } from '~/lib/style';

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

	test('clips a name and tags that would run under the time, and leaves a short one whole', () => {
		const long = { ...plain, nameWidth: 180 };

		expect(headingPlace(long, bubble, 79, 14).nameClip).toBe(250 - 14 * 2 - 8 - 93);
		expect(headingPlace(plain, bubble, 79, 14).nameClip).toBeUndefined();
		expect(headingPlace(long, bubble, 79, 14, 14, { keepTime: true }).nameClip).toBeUndefined();
	});

	test('puts the reply in a box between the name and the text, clipped to the box', () => {
		const place = headingPlace(reply, bubble, 79, 14);

		expect(place.name).toEqual({ x: 14, y: -28 });
		expect(place.avatar).toEqual({ x: 0, y: -28 });
		expect(place.reply).toEqual({
			move: { x: 30, y: 12.5 },
			quote: {
				box: { x: 74, y: 55, width: 238, height: 20 },
				clip: { x: 44, y: 1.5, width: 230, height: 20 },
			},
		});
	});

	test('keeps the name in place and sits an unquoted reply a gap above the bubble', () => {
		const place = headingPlace(reply, bubble, 79, 14, 14, { quoted: false });

		expect(headingRoom(reply, 300, 14, false)).toEqual(headingRoom(plain, 0, 14));
		expect(place.name).toEqual({ x: 14, y: 0 });
		// The preview's bottom, 43 + 19, moves to 4 above the bubble's top at 19.
		expect(place.reply).toEqual({ move: { x: 0, y: 19 - 4 - 62 } });
	});

	test('leaves the time where Discord put it when asked', () => {
		expect(headingPlace(plain, bubble, 79, 14, 14, { keepTime: true }).time).toBeUndefined();
	});

	test('quotes replies in fitted bubbles only with the name inside, and in cards on their own', () => {
		const look = (values: Record<string, unknown>) =>
			bubbleAppearance((key) => values[key], { red: 0, green: 0, blue: 0 });

		expect(headingSpot(look({}), reply)).toEqual({ inside: true, quoted: true });
		expect(headingSpot(look({ avatarLast: true }), reply)).toEqual({
			inside: true,
			quoted: false,
		});
		expect(headingSpot(look({ nameInside: false }), reply)).toEqual({
			inside: false,
			quoted: false,
		});
		expect(headingSpot(look({ layout: 'card' }), reply)).toEqual({
			inside: true,
			quoted: true,
		});
		expect(headingSpot(look({ layout: 'card' }), plain)).toEqual({
			inside: false,
			quoted: false,
		});
		expect(headingSpot(look({ layout: 'card', reply: 'icon' }), reply)).toEqual({
			inside: false,
			quoted: false,
		});
	});

	test("stretches a quoted card up over the name's new top", () => {
		const card = { x: 63, y: 51, width: 300, height: 60 };

		// The name moves to 41 - 12, and the card keeps its padding of 6 above it.
		expect(quotedCard(card, reply, { quoted: true, vertical: 6 })).toEqual({
			...card,
			y: 23,
			height: 88,
		});
		expect(quotedCard(card, reply, { quoted: false, vertical: 6 })).toBe(card);
	});
});
