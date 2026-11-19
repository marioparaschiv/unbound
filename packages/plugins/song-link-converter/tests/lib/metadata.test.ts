import { describe, expect, test } from 'bun:test';

import { searchQuery, type Fetcher } from '~/lib/metadata';

function fetcherFor(body: string, ok = true): Fetcher {
	return () => Promise.resolve({ ok, text: () => Promise.resolve(body) });
}

describe('searchQuery', () => {
	test('reads Spotify from its Open Graph tags', async () => {
		const html =
			'<meta property="og:title" content="Never Gonna Give You Up"/><meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987"/>';

		expect(await searchQuery({ service: 'spotify', url: 'x' }, fetcherFor(html))).toBe(
			'Rick Astley Never Gonna Give You Up',
		);
	});

	test('reads Apple Music, YouTube Music and Deezer from their APIs', async () => {
		expect(
			await searchQuery(
				{ service: 'appleMusic', id: '1', country: 'us' },
				fetcherFor(
					JSON.stringify({ results: [{ trackName: 'Song', artistName: 'Artist' }] }),
				),
			),
		).toBe('Artist Song');
		expect(
			await searchQuery(
				{ service: 'youtubeMusic', url: 'x' },
				fetcherFor(JSON.stringify({ title: 'Song', author_name: 'Artist - Topic' })),
			),
		).toBe('Artist Song');
		expect(
			await searchQuery(
				{ service: 'deezer', kind: 'album', id: '2' },
				fetcherFor(JSON.stringify({ title: 'Album', artist: { name: 'Band' } })),
			),
		).toBe('Band Album');
	});

	test('gives nothing when the service has no title', async () => {
		expect(
			await searchQuery({ service: 'deezer', kind: 'track', id: '3' }, fetcherFor('', false)),
		).toBeUndefined();
	});
});
