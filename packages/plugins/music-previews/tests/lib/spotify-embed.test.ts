import { describe, expect, test } from 'bun:test';

import { embedUrl, parseEmbed } from '~/lib/spotify-embed';

const page = (entity: unknown) =>
	`<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
		props: { pageProps: { state: { data: { entity } } } },
	})}</script></html>`;

describe('spotify embed pages', () => {
	test('reads a song with its preview and cover', () => {
		const embed = parseEmbed(
			page({
				name: 'Song',
				artists: [{ name: 'A' }, { name: 'B' }],
				audioPreview: { url: 'https://p.scdn.co/mp3-preview/1' },
				visualIdentity: { image: [{ url: 'https://i.scdn.co/cover' }] },
			}),
		);

		expect(embed).toEqual({
			title: 'Song',
			subtitle: 'A, B',
			cover: 'https://i.scdn.co/cover',
			tracks: [
				{ title: 'Song', subtitle: 'A, B', preview: 'https://p.scdn.co/mp3-preview/1' },
			],
		});
	});

	test('reads the tracks of an album or playlist, some without a preview', () => {
		const embed = parseEmbed(
			page({
				name: 'Album',
				subtitle: 'Band',
				trackList: [
					{
						title: 'One',
						subtitle: 'Band X',
						audioPreview: { url: 'https://p.scdn.co/1' },
					},
					{ title: 'Two', subtitle: 'Band' },
					{ subtitle: 'untitled' },
				],
			}),
		);

		expect(embed?.subtitle).toBe('Band');
		expect(embed?.tracks).toEqual([
			{ title: 'One', subtitle: 'Band X', preview: 'https://p.scdn.co/1' },
			{ title: 'Two', subtitle: 'Band', preview: undefined },
		]);
	});

	test('gives up on pages without data', () => {
		expect(parseEmbed('<html></html>')).toBeUndefined();
		expect(
			parseEmbed('<script id="__NEXT_DATA__" type="application/json">{</script>'),
		).toBeUndefined();
		expect(parseEmbed(page(null))).toBeUndefined();
	});
});

describe('spotify embed URLs', () => {
	test('builds the embed page URL', () => {
		expect(embedUrl('track', 'abc')).toBe('https://open.spotify.com/embed/track/abc');
	});
});
