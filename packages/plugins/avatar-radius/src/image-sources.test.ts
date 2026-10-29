import { expect, test } from 'bun:test';

import { mayBeAvatar } from './image-sources';

test('keeps user, member and default avatars', () => {
	expect(mayBeAvatar('https://cdn.discordapp.com/avatars/1/abc.webp?size=128')).toBe(true);
	expect(mayBeAvatar('https://cdn.discordapp.com/guilds/1/users/2/avatars/abc.png')).toBe(true);
	expect(mayBeAvatar('https://cdn.discordapp.com/embed/avatars/3.png')).toBe(true);
	expect(mayBeAvatar('res:/2131231269')).toBe(true);
	expect(mayBeAvatar(undefined)).toBe(true);
});

test('skips server icons, badges and emojis', () => {
	expect(mayBeAvatar('https://cdn.discordapp.com/icons/1/abc.webp?size=96')).toBe(false);
	expect(mayBeAvatar('https://cdn.discordapp.com/clan-badges/1/abc')).toBe(false);
	expect(mayBeAvatar('https://cdn.discordapp.com/emojis/1.webp?animated=true')).toBe(false);
	expect(mayBeAvatar('https://cdn.discordapp.com/role-icons/1/abc.png')).toBe(false);
	expect(mayBeAvatar('https://cdn.discordapp.com/app-icons/1/abc.png')).toBe(false);
});
