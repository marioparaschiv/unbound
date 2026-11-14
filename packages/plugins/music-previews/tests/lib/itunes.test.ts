import { describe, expect, test } from 'bun:test';

import { bestPreview, collectionOf, parseResults } from '~/lib/itunes';

const song = (trackName: string, artistName: string, previewUrl?: string) => ({
	wrapperType: 'track',
	trackName,
	collectionName: 'Album',
	artistName,
	previewUrl,
	artworkUrl100: 'https://is1.mzstatic.com/a/100x100bb.jpg',
});

describe('iTunes results', () => {
	test('reads results and drops what is not an object', () => {
		expect(parseResults({ results: [song('A', 'B', 'https://clip'), 'x', null] })).toHaveLength(
			1,
		);
		expect(parseResults({})).toEqual([]);
		expect(parseResults(null)).toEqual([]);
	});

	test('ignores clip URLs that are not https', () => {
		expect(
			parseResults({ results: [song('A', 'B', 'http://clip')] })[0]?.previewUrl,
		).toBeUndefined();
	});

	test('builds an album with its songs and a larger cover', () => {
		const items = parseResults({
			results: [
				{
					wrapperType: 'collection',
					collectionName: 'Album',
					artistName: 'Band',
					artworkUrl100: 'https://x/100x100bb.jpg',
				},
				song('One', 'Band', 'https://clip/1'),
			],
		});

		expect(collectionOf(items)).toEqual({
			title: 'Album',
			subtitle: 'Band',
			cover: 'https://x/300x300bb.jpg',
			tracks: [{ title: 'One', subtitle: 'Band', preview: 'https://clip/1' }],
		});
	});

	test('builds a single song and finds nothing in an empty lookup', () => {
		expect(
			collectionOf(parseResults({ results: [song('One', 'Band', 'https://clip/1')] }))?.title,
		).toBe('One');
		expect(collectionOf([])).toBeUndefined();
	});

	test('picks the best matching result that has a clip', () => {
		const items = parseResults({
			results: [
				song('Never Gonna Give You Up', 'Cover Band', 'https://clip/cover'),
				song('Never Gonna Give You Up', 'Rick Astley', 'https://clip/rick'),
				song('Never Gonna Give You Up', 'Rick Astley'),
			],
		});

		expect(bestPreview(items, 'Never Gonna Give You Up Rick Astley')).toBe('https://clip/rick');
		expect(bestPreview([], 'anything')).toBeUndefined();
	});
});
