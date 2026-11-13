import { describe, expect, test } from 'bun:test';

import { gifAltText, gifName } from '~/lib/alt';

describe('gif labels', () => {
	test('reads the tags from a Tenor link and strips its id', () => {
		expect(gifName('https://tenor.com/view/cat-dance-happy-12345678')).toBe('cat dance happy');
	});

	test('reads a file name without its numbers or extension', () => {
		expect(gifName('https://cdn.example.com/a/party_time2.gif?width=100')).toBe('party time');
	});

	test('gives alt text to GIFs only, from words in their address', () => {
		const tenor = 'https://tenor.com/view/cat-dance-123';

		expect(gifAltText('GIF, button', tenor)).toBe('cat dance');
		expect(gifAltText('Image, button', tenor)).toBe('');
		expect(gifAltText('GIF, button', 'https://example.com/123.gif')).toBe('');
		expect(gifAltText('GIF, button', undefined)).toBe('');
	});
});
