import { expect, test } from 'bun:test';

import { bundledFilePath } from '~/native/image-cache';

test('reads a bundled default avatar from its decoded file path', () => {
	expect(bundledFilePath('file:///private/Discord.app/default%20avatar.png')).toBe(
		'/private/Discord.app/default avatar.png',
	);
});

test('treats any other URL as not bundled', () => {
	expect(bundledFilePath('https://cdn.discordapp.com/avatars/1/a.png')).toBeUndefined();
	expect(bundledFilePath('http://example.com/a.png')).toBeUndefined();
});
