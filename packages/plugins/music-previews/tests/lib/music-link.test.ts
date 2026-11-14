import { describe, expect, test } from 'bun:test';

import { parseMusicLink } from '~/lib/music-link';

const ID = '4uLU6hMCjMI75M1A2tKUQC';

describe('music links', () => {
	test('reads Spotify songs, albums and playlists, localized or with a query', () => {
		expect(parseMusicLink(`https://open.spotify.com/track/${ID}?si=abc`)).toEqual({
			service: 'spotify',
			kind: 'track',
			id: ID,
		});
		expect(parseMusicLink(`https://open.spotify.com/intl-de/album/${ID}`)).toMatchObject({
			kind: 'album',
		});
		expect(parseMusicLink(`https://open.spotify.com/playlist/${ID}`)).toMatchObject({
			kind: 'playlist',
		});
	});

	test('reads Apple Music albums, songs and songs inside an album link', () => {
		expect(parseMusicLink('https://music.apple.com/us/album/best-of/1773292758')).toEqual({
			service: 'apple',
			kind: 'album',
			id: '1773292758',
			country: 'us',
		});
		expect(
			parseMusicLink('https://music.apple.com/GB/album/best-of/1773292758?i=1773293184'),
		).toEqual({
			service: 'apple',
			kind: 'song',
			id: '1773293184',
			country: 'gb',
		});
		expect(parseMusicLink('https://music.apple.com/us/song/never/1773293184')).toMatchObject({
			kind: 'song',
			id: '1773293184',
		});
	});

	test('ignores other links', () => {
		expect(parseMusicLink(`https://open.spotify.com/artist/${ID}`)).toBeUndefined();
		expect(parseMusicLink('https://music.apple.com/us/playlist/hits/pl.abc')).toBeUndefined();
		expect(parseMusicLink('https://example.com/track/x')).toBeUndefined();
	});
});
