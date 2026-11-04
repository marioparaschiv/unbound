import { expect, test } from 'bun:test';

import { avatarUrl, roleIcon } from '~/viewer/sheets/images';

test('a role icon prefers the uploaded image, then the emoji', () => {
	expect(roleIcon({ id: '1', icon: 'abc', unicodeEmoji: '🔥' }, 40)).toEqual({
		kind: 'image',
		uri: 'https://cdn.discordapp.com/role-icons/1/abc.png?size=40',
	});
	expect(roleIcon({ id: '1', unicodeEmoji: '🔥' }, 40)).toEqual({ kind: 'emoji', emoji: '🔥' });
	expect(roleIcon({ id: '1' }, 40)).toBeUndefined();
});

test('an avatar falls back to the default avatar for the user ID', () => {
	expect(avatarUrl({ id: '1', avatar: 'hash' }, 40)).toBe(
		'https://cdn.discordapp.com/avatars/1/hash.png?size=40',
	);
	expect(avatarUrl({ id: '224617799434108928', avatar: null }, 40)).toBe(
		`https://cdn.discordapp.com/embed/avatars/${(224617799434108928n >> 22n) % 6n}.png`,
	);
	expect(avatarUrl({ id: 'x' }, 40)).toBe('https://cdn.discordapp.com/embed/avatars/0.png');
});
