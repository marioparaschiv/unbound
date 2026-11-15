import { describe, expect, test } from 'bun:test';

import { joinedUsers } from '~/lib/joins';

const chosen = new Set(['a', 'b']);

describe('joinedUsers', () => {
	test('finds chosen users moving into your channel', () => {
		const before: Record<string, string | null> = { a: null, b: 'other', c: null };

		expect(
			joinedUsers(
				[
					{ userId: 'a', channelId: 'mine' },
					{ userId: 'b', channelId: 'mine' },
					{ userId: 'c', channelId: 'mine' },
				],
				'mine',
				(id) => before[id],
				chosen,
				'me',
			),
		).toEqual(['a', 'b']);
	});

	test('ignores updates within your channel, other channels and when you are not in one', () => {
		expect(
			joinedUsers([{ userId: 'a', channelId: 'mine' }], 'mine', () => 'mine', chosen, 'me'),
		).toEqual([]);
		expect(
			joinedUsers([{ userId: 'a', channelId: 'other' }], 'mine', () => null, chosen, 'me'),
		).toEqual([]);
		expect(
			joinedUsers([{ userId: 'a', channelId: 'mine' }], undefined, () => null, chosen, 'me'),
		).toEqual([]);
	});
});
