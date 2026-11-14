import { describe, expect, test } from 'bun:test';

import { parseMusicLink } from '~/lib/music-link';
import { deezerCollection } from '~/lib/deezer';
import { tidalCollection } from '~/lib/tidal';
import { clipType } from '~/lib/clips';

describe('Deezer and Tidal links', () => {
	test('reads Deezer songs, albums and playlists, localized or not', () => {
		expect(parseMusicLink('https://www.deezer.com/en/track/3135556?utm_source=x')).toEqual({
			service: 'deezer',
			kind: 'track',
			id: '3135556',
		});
		expect(parseMusicLink('https://deezer.com/album/302127')).toMatchObject({ kind: 'album' });
		expect(parseMusicLink('https://www.deezer.com/pt-br/playlist/908622995')).toMatchObject({
			kind: 'playlist',
		});
	});

	test('reads Tidal songs from both hosts', () => {
		expect(parseMusicLink('https://tidal.com/browse/track/77646168/u')).toEqual({
			service: 'tidal',
			kind: 'track',
			id: '77646168',
		});
		expect(parseMusicLink('https://listen.tidal.com/track/77646168')).toMatchObject({
			service: 'tidal',
		});
	});
});

describe('Deezer collections', () => {
	test('lists an album with its clips and cover', () => {
		const collection = deezerCollection({
			title: 'Discovery',
			artist: { name: 'Daft Punk' },
			cover_xl: 'https://cdn-images.dzcdn.net/cover.jpg',
			tracks: {
				data: [
					{
						title: 'One More Time',
						artist: { name: 'Daft Punk' },
						preview: 'https://cdnt-preview.dzcdn.net/1.mp3',
					},
					{ title: 'Aerodynamic', artist: { name: 'Daft Punk' }, preview: '' },
				],
			},
		});

		expect(collection).toMatchObject({
			title: 'Discovery',
			subtitle: 'Daft Punk',
			cover: 'https://cdn-images.dzcdn.net/cover.jpg',
		});
		expect(collection?.tracks[0]?.preview).toBe('https://cdnt-preview.dzcdn.net/1.mp3');
		expect(collection?.tracks[1]?.search).toBe('Aerodynamic Daft Punk');
	});

	test('treats a song as its own only track, and an error as nothing', () => {
		expect(
			deezerCollection({
				title: 'Harder',
				artist: { name: 'Daft Punk' },
				album: { cover_xl: 'https://x/c.jpg' },
			}),
		).toMatchObject({ cover: 'https://x/c.jpg', tracks: [{ title: 'Harder' }] });
		expect(deezerCollection({ error: { type: 'DataException' } })).toBeUndefined();
	});

	test('plays Deezer clips as MP3', () => {
		expect(clipType('https://cdnt-preview.dzcdn.net/api/1/1/a.mp3')).toBe('audio/mpeg');
	});
});

describe('Tidal collections', () => {
	test('reads the artist and title from the track page', () => {
		const html =
			'<meta property="og:title" content="Daft Punk - One More Time &amp; Again"><meta property="og:image" content="https://resources.tidal.com/c.jpg">';

		expect(tidalCollection(html)).toMatchObject({
			title: 'One More Time & Again',
			subtitle: 'Daft Punk',
			cover: 'https://resources.tidal.com/c.jpg',
			tracks: [{ search: 'One More Time & Again Daft Punk' }],
		});
	});

	test('finds nothing on a not-found page', () => {
		expect(
			tidalCollection('<meta property="og:title" content="Not Found - TIDAL">'),
		).toBeUndefined();
	});
});
