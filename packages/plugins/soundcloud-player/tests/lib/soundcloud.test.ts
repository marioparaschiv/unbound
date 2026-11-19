import { describe, expect, test } from 'bun:test';

import { playerUrl, soundcloudLink, staysInPlayer } from '~/lib/soundcloud';

describe('soundcloud', () => {
	test('reads track, playlist and short links', () => {
		expect(soundcloudLink('https://soundcloud.com/artist/track-name?si=abc')).toBe(
			'https://soundcloud.com/artist/track-name',
		);
		expect(soundcloudLink('https://m.soundcloud.com/artist/sets/mix')).toBe(
			'https://m.soundcloud.com/artist/sets/mix',
		);
		expect(soundcloudLink('https://on.soundcloud.com/AbC123')).toBe(
			'https://on.soundcloud.com/AbC123',
		);
		expect(soundcloudLink('https://soundcloud.com/artist')).toBeUndefined();
		expect(soundcloudLink('https://example.com/a/b')).toBeUndefined();
	});

	test('builds the player address and keeps its pages in the sheet', () => {
		const url = playerUrl('https://soundcloud.com/a/b');

		expect(url).toStartWith(
			'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb',
		);
		expect(staysInPlayer(url)).toBe(true);
		expect(staysInPlayer('https://soundcloud.com/a/b')).toBe(false);
	});
});
