import { describe, expect, test } from 'bun:test';

import {
	cleanName,
	createCollection,
	deleteCollection,
	parseCollections,
	toggleGif,
} from '~/lib/collections';

const gif = (id: string) => ({
	url: `https://tenor.com/${id}`,
	src: `https://media/${id}.mp4`,
	width: 10,
	height: 10,
	format: 2,
});

describe('collections', () => {
	test('creates collections with unique, tidy names', () => {
		const one = createCollection([], '  Reaction   pics ', gif('a'));

		expect(one).toEqual([{ name: 'Reaction pics', gifs: [gif('a')] }]);
		expect(createCollection(one, 'reaction PICS', gif('b'))[0]!.gifs).toEqual([
			gif('b'),
			gif('a'),
		]);
		expect(createCollection(one, '   ')).toBe(one);
		expect(cleanName('x'.repeat(40))).toHaveLength(32);
	});

	test('toggles a GIF in and out, newest first', () => {
		const start = [{ name: 'Cats', gifs: [gif('a')] }];

		expect(toggleGif(start, 'cats', gif('b'))[0]!.gifs).toEqual([gif('b'), gif('a')]);
		expect(toggleGif(start, 'Cats', gif('a'))[0]!.gifs).toEqual([]);
	});

	test('deletes a collection', () => {
		expect(deleteCollection([{ name: 'Cats', gifs: [] }], 'CATS')).toEqual([]);
	});

	test('drops malformed stored data', () => {
		expect(
			parseCollections([{ name: 'Ok', gifs: [gif('a'), { url: 1 }] }, { gifs: [] }, 'x']),
		).toEqual([{ name: 'Ok', gifs: [gif('a')] }]);
		expect(parseCollections(undefined)).toEqual([]);
	});
});
