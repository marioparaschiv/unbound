import { describe, expect, test } from 'bun:test';

import { addFavorites, removeFavorite, withLocalFavorites, type Favorite } from '~/lib/favorites';

const account: Record<string, Favorite> = {
	a: { id: 'a', nickname: null, type: 1, channelType: 0, order: 0, parentId: null },
};

describe('local favorites', () => {
	test('adds local channels after the account ones', () => {
		const merged = withLocalFavorites(account, ['b', 'a'], () => 2);

		expect(merged.a).toBe(account.a);
		expect(merged.b).toMatchObject({ id: 'b', channelType: 2, order: 1e6 });
	});

	test('returns the account favorites when nothing is local', () => {
		expect(withLocalFavorites(account, [], () => 0)).toBe(account);
	});

	test('adds and removes ids once each', () => {
		expect(addFavorites('1, 2', ['2', '3'])).toBe('1, 2, 3');
		expect(removeFavorite('1, 2, 3', '2')).toBe('1, 3');
	});
});
