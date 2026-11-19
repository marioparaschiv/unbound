import { describe, expect, test } from 'bun:test';

import { readMusicLink, searchLink } from '~/lib/links';

describe('readMusicLink', () => {
	test('reads each service', () => {
		expect(
			readMusicLink('https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT?si=x'),
		).toEqual({
			service: 'spotify',
			url: 'https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT',
		});
		expect(
			readMusicLink(
				'https://music.apple.com/us/album/never-gonna/1773292758?i=1773293184&uo=4',
			),
		).toEqual({
			service: 'appleMusic',
			country: 'us',
			id: '1773293184',
		});
		expect(readMusicLink('https://music.apple.com/gb/album/whenever/1773292758')).toEqual({
			service: 'appleMusic',
			country: 'gb',
			id: '1773292758',
		});
		expect(
			readMusicLink('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'),
		).toEqual({
			service: 'youtubeMusic',
			url: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
		});
		expect(readMusicLink('https://www.deezer.com/en/track/781592622')).toEqual({
			service: 'deezer',
			kind: 'track',
			id: '781592622',
		});
	});

	test('ignores other links', () => {
		expect(readMusicLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
		expect(readMusicLink('https://open.spotify.com/user/someone')).toBeUndefined();
	});
});

describe('searchLink', () => {
	test('encodes the query for the chosen service', () => {
		expect(searchLink('appleMusic', 'Rick Astley Never Gonna')).toBe(
			'https://music.apple.com/search?term=Rick%20Astley%20Never%20Gonna',
		);
		expect(searchLink('spotify', 'AC/DC')).toBe('https://open.spotify.com/search/AC%2FDC');
	});
});
