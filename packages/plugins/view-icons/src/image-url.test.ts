import { expect, test } from 'bun:test';

import { normalizeImageUrl } from './image-url';

test('requests a static image as WebP at the given size', () => {
	expect(normalizeImageUrl('https://cdn.discordapp.com/avatars/1/abc.png?size=128', 4096)).toBe(
		'https://cdn.discordapp.com/avatars/1/abc.webp?size=4096',
	);
});

test('requests an animated image as GIF, by hash prefix or query flag', () => {
	expect(normalizeImageUrl('https://cdn.discordapp.com/avatars/1/a_abc.webp', 4096)).toBe(
		'https://cdn.discordapp.com/avatars/1/a_abc.gif?size=4096',
	);
	expect(
		normalizeImageUrl('https://cdn.discordapp.com/banners/1/abc.png?animated=true', 512),
	).toBe('https://cdn.discordapp.com/banners/1/abc.gif?animated=true&size=512');
});

test('resolves relative URLs against discord.com and leaves data URIs alone', () => {
	expect(normalizeImageUrl('/assets/default.png', 64)).toBe(
		'https://discord.com/assets/default.webp?size=64',
	);
	expect(normalizeImageUrl('data:image/png;base64,AAAA', 64)).toBe('data:image/png;base64,AAAA');
});
