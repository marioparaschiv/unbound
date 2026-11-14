import { describe, expect, test } from 'bun:test';

import { unreadGuilds } from '~/lib/unread-guilds';

const state = (unread: string[], muted: string[], mentions: Record<string, number>) => ({
	hasUnread: (id: string) => unread.includes(id),
	getGuildHasUnreadIgnoreMuted: (id: string) => muted.includes(id),
	getMentionCount: (id: string) => mentions[id] ?? 0,
});

describe('unread guilds', () => {
	test('keeps servers with unreads, muted unreads or mentions, in order', () => {
		expect(unreadGuilds(['1', '2', '3', '4'], state(['3'], ['1'], { 4: 2 }))).toEqual([
			'1',
			'3',
			'4',
		]);
	});

	test('finds nothing when every server is read', () => {
		expect(unreadGuilds(['1', '2'], state([], [], {}))).toEqual([]);
	});
});
