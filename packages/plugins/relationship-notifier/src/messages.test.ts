import { describe, expect, test } from 'bun:test';

import { messages, uniqueUsername } from '~/messages';

describe('uniqueUsername', () => {
	test('uses the bare username for unique usernames', () => {
		expect(uniqueUsername({ username: 'adrian', discriminator: '0' })).toBe('adrian');
		expect(uniqueUsername({ username: 'adrian' })).toBe('adrian');
	});

	test('keeps a legacy tag', () => {
		expect(uniqueUsername({ username: 'nick', discriminator: '1234' })).toBe('nick#1234');
	});
});

describe('messages', () => {
	test('match Vencord wording', () => {
		expect(messages.removedFriend('a')).toBe('a removed you as a friend.');
		expect(messages.removedRequest('a')).toBe('A friend request from a has been removed.');
		expect(messages.removedFromServer('S')).toBe('You were removed from the server S.');
		expect(messages.removedFromGroup('G')).toBe('You were removed from the group G.');
		expect(messages.offlineServer('S')).toBe('You are no longer in the server S.');
		expect(messages.offlineGroup('G')).toBe('You are no longer in the group G.');
		expect(messages.offlineFriend('a')).toBe('You are no longer friends with a.');
		expect(messages.offlineRequest('a')).toBe('Friend request from a has been revoked.');
	});
});
