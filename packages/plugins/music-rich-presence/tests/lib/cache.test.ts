import { describe, expect, test } from 'bun:test';

import { createTtlCache } from '~/lib/cache';

describe('createTtlCache', () => {
	test('expires entries after the TTL', () => {
		let now = 0;
		const cache = createTtlCache<string, string>(100, () => now);

		cache.set('a', 'x');
		now = 99;
		expect(cache.has('a')).toBe(true);
		expect(cache.get('a')).toBe('x');
		now = 100;
		expect(cache.has('a')).toBe(false);
		expect(cache.get('a')).toBeUndefined();
	});

	test('keeps undefined values as cached and clears everything', () => {
		const cache = createTtlCache<string, string | undefined>(100, () => 0);

		cache.set('a', undefined);
		expect(cache.has('a')).toBe(true);
		cache.clear();
		expect(cache.has('a')).toBe(false);
	});
});
