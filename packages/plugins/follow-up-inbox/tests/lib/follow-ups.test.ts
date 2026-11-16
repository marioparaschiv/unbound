import { describe, expect, test } from 'bun:test';

import {
	addFollowUp,
	isFollowedUp,
	parseFollowUps,
	removeFollowUp,
	snippetOf,
	type FollowUp,
} from '~/lib/follow-ups';

const entry = (messageId: string, addedAt: number): FollowUp => ({
	channelId: 'c',
	messageId,
	guildId: null,
	author: 'mario',
	snippet: 'hi',
	addedAt,
});

describe('follow-ups', () => {
	test('reads saved entries newest first and drops malformed ones', () => {
		expect(
			parseFollowUps([entry('1', 1), { messageId: 2 }, entry('3', 3)]).map(
				(e) => e.messageId,
			),
		).toEqual(['3', '1']);
		expect(parseFollowUps('nope')).toEqual([]);
	});

	test('adds, finds and removes by message', () => {
		const list = addFollowUp(addFollowUp([], entry('1', 1)), entry('1', 2));

		expect(list).toHaveLength(1);
		expect(isFollowedUp(list, '1')).toBe(true);
		expect(removeFollowUp(list, '1')).toEqual([]);
	});

	test('shortens text to one line', () => {
		expect(snippetOf('a\n\nb')).toBe('a b');
		expect(snippetOf('x'.repeat(200))).toHaveLength(120);
	});
});
