import { describe, expect, test } from 'bun:test';

import { idList, isEphemeral, shouldIgnore, type FilterSettings } from '~/log/filters';

const settings: FilterSettings = {
	logDeletes: true,
	logEdits: true,
	ignoreBots: true,
	ignoreSelf: false,
	ignoreUsers: '',
	ignoreChannels: '',
	ignoreGuilds: '',
};

const context = { currentUserId: 'me', channel: { guild_id: 'guild', parent_id: 'category' } };

describe('idList', () => {
	test('splits on commas, spaces and new lines', () => {
		expect([...idList('1, 2\n3  4,,')]).toEqual(['1', '2', '3', '4']);
	});
});

describe('shouldIgnore', () => {
	const message = { author: { id: 'user' }, channel_id: 'channel', flags: 0 };

	test('logs an ordinary message', () => {
		expect(shouldIgnore(message, settings, context, false)).toBe(false);
	});

	test('ignores ephemeral messages', () => {
		expect(isEphemeral({ flags: 64 })).toBe(true);
		expect(shouldIgnore({ ...message, flags: 64 }, settings, context, false)).toBe(true);
	});

	test('follows the delete and edit switches separately', () => {
		expect(shouldIgnore(message, { ...settings, logDeletes: false }, context, false)).toBe(
			true,
		);
		expect(shouldIgnore(message, { ...settings, logDeletes: false }, context, true)).toBe(
			false,
		);
		expect(shouldIgnore(message, { ...settings, logEdits: false }, context, true)).toBe(true);
	});

	test('ignores bots and the current user when asked', () => {
		expect(
			shouldIgnore(
				{ ...message, author: { id: 'bot', bot: true } },
				settings,
				context,
				false,
			),
		).toBe(true);
		expect(shouldIgnore({ ...message, author: { id: 'me' } }, settings, context, false)).toBe(
			false,
		);
		expect(
			shouldIgnore(
				{ ...message, author: { id: 'me' } },
				{ ...settings, ignoreSelf: true },
				context,
				false,
			),
		).toBe(true);
	});

	test('ignores listed users, channels, categories and servers by exact ID', () => {
		expect(shouldIgnore(message, { ...settings, ignoreUsers: 'user' }, context, false)).toBe(
			true,
		);
		expect(shouldIgnore(message, { ...settings, ignoreUsers: 'use' }, context, false)).toBe(
			false,
		);
		expect(
			shouldIgnore(message, { ...settings, ignoreChannels: 'channel' }, context, false),
		).toBe(true);
		expect(
			shouldIgnore(message, { ...settings, ignoreChannels: 'category' }, context, false),
		).toBe(true);
		expect(shouldIgnore(message, { ...settings, ignoreGuilds: 'guild' }, context, false)).toBe(
			true,
		);
	});
});
