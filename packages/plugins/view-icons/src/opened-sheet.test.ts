import { expect, test } from 'bun:test';

import { toOpenedSheet } from './opened-sheet';

test('recognizes a user profile sheet with its guild', () => {
	expect(toOpenedSheet('UserProfileActionSheet', { userId: '1', guildId: '2' })).toEqual({
		kind: 'profile',
		userId: '1',
		guildId: '2',
	});
	expect(toOpenedSheet('UserProfile', { userId: '1', guildId: '' })).toEqual({
		kind: 'profile',
		userId: '1',
		guildId: undefined,
	});
});

test('recognizes a guild sheet by its key and guild prop', () => {
	const guild = { id: '3' };

	expect(toOpenedSheet('GuildActionSheet:3', { guild })).toEqual({ kind: 'guild', guild });
});

test('reads a profile sheet with a non-string user ID as showing nobody', () => {
	expect(toOpenedSheet('UserProfileActionSheet', { userId: 1 })).toBeNull();
});

test('ignores other sheets and sheets missing their subject', () => {
	expect(toOpenedSheet('MessageLongPressActionSheet', { userId: '1' })).toBeUndefined();
	expect(toOpenedSheet('UserProfileActionSheet', {})).toBeUndefined();
	expect(toOpenedSheet('GuildActionSheet:3', { guild: '3' })).toBeUndefined();
});
