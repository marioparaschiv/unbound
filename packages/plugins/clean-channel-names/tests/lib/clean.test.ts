import { describe, expect, test } from 'bun:test';

import { cleanChannelName } from '~/lib/clean';

const spaces = { spaces: true };

describe('clean channel names', () => {
	test('turns dashes into spaces', () => {
		expect(cleanChannelName('general-chat', 0, spaces)).toBe('general chat');
		expect(cleanChannelName('general-chat', 0, { spaces: false })).toBe('general-chat');
	});

	test('drops emoji and decorative separators', () => {
		expect(cleanChannelName('📢・announcements', 5, spaces)).toBe('announcements');
		expect(cleanChannelName('┃🎮┃gaming-talk', 0, spaces)).toBe('gaming talk');
		expect(cleanChannelName('rules|info', 0, spaces)).toBe('rules info');
	});

	test('turns decorative letters into plain ones', () => {
		expect(cleanChannelName('ɢᴇɴᴇʀᴀʟ', 0, spaces)).toBe('general');
	});

	test('keeps names cleaning would empty', () => {
		expect(cleanChannelName('🎉', 0, spaces)).toBe('🎉');
	});
});
