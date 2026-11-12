import { describe, expect, test } from 'bun:test';

import { groupEdges, groupNeighbours, messageGroups } from '~/lib/row-groups';

type Message = { id: string; author: string };

const newAuthor = (first: Message, message: Message) => first.author !== message.author;

describe('row groups', () => {
	test("reads each message's group edges from the chat rows, newest first", () => {
		const edges = groupEdges([
			{ isFirst: false, message: { id: 'b2' } },
			{ isFirst: true, message: { id: 'b1' } },
			{},
			{ isFirst: false, message: { id: 'a2' } },
			{ isFirst: true, message: { id: 'a1' } },
		]);

		expect(Object.fromEntries(edges)).toEqual({
			b2: { start: false, end: true },
			b1: { start: true, end: false },
			a2: { start: false, end: true },
			a1: { start: true, end: false },
		});
	});

	test("reads each message's neighbours from the chat rows, a divider leaving none", () => {
		const adjacent = groupNeighbours([
			{ isFirst: false, message: { id: 'b2' } },
			{ isFirst: true, message: { id: 'b1' } },
			{},
			{ isFirst: true, message: { id: 'a1' } },
		]);

		expect(Object.fromEntries(adjacent)).toEqual({
			b2: { above: 'b1' },
			b1: { below: 'b2' },
			a1: {},
		});
	});

	test("places each message from the channel's messages, oldest first, ending a group at its last message", () => {
		const places = messageGroups(
			[
				{ id: 'a1', author: 'a' },
				{ id: 'a2', author: 'a' },
				{ id: 'a3', author: 'a' },
				{ id: 'b1', author: 'b' },
			],
			newAuthor,
		);

		expect(Object.fromEntries(places)).toEqual({
			a1: { start: true, end: false, below: 'a2' },
			a2: { start: false, end: false, above: 'a1', below: 'a3' },
			a3: { start: false, end: true, above: 'a2', below: 'b1' },
			b1: { start: true, end: true, above: 'a3' },
		});
	});

	test('ends the group at the newest message, however many rows are on screen', () => {
		const places = messageGroups(
			[
				{ id: 'a1', author: 'a' },
				{ id: 'a2', author: 'a' },
			],
			newAuthor,
		);

		expect(places.get('a1')).toMatchObject({ start: true, end: false });
		expect(places.get('a2')).toMatchObject({ start: false, end: true });
	});

	test("compares each message with its group's first message", () => {
		const compared: string[] = [];

		messageGroups(
			[
				{ id: 'a1', author: 'a' },
				{ id: 'a2', author: 'a' },
				{ id: 'a3', author: 'a' },
			],
			(first, message) => {
				compared.push(`${first.id}>${message.id}`);

				return false;
			},
		);

		expect(compared).toEqual(['a1>a2', 'a1>a3']);
	});

	test('skips rows without a message or a group flag', () => {
		expect(groupEdges([{ message: { id: 'a' } }, { isFirst: true, message: null }]).size).toBe(
			0,
		);
	});
});
