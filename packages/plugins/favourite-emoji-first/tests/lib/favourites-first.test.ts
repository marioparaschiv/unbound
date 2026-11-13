import { describe, expect, test } from 'bun:test';

import { favouritesFirst } from '~/lib/favourites-first';

const isFavourite = (name: string) => name.startsWith('fav');

describe('favouritesFirst', () => {
	test('moves favourites ahead and keeps each group in order', () => {
		expect(favouritesFirst(['a', 'fav1', 'b', 'fav2'], isFavourite, 10)).toEqual([
			'fav1',
			'fav2',
			'a',
			'b',
		]);
	});

	test('cuts the result to the limit after sorting', () => {
		expect(favouritesFirst(['a', 'b', 'c', 'fav1'], isFavourite, 2)).toEqual(['fav1', 'a']);
	});

	test('returns nothing for an empty list', () => {
		expect(favouritesFirst([], isFavourite, 10)).toEqual([]);
	});
});
