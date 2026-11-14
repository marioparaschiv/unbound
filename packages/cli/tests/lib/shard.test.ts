import { describe, expect, test } from 'bun:test';

import { inShard, parseShard } from '~/lib/shard';

describe('shards', () => {
	test('reads index/count', () => {
		expect(parseShard('2/3')).toEqual({ index: 2, count: 3 });
		expect(parseShard('0/3')).toBeUndefined();
		expect(parseShard('4/3')).toBeUndefined();
		expect(parseShard('half')).toBeUndefined();
		expect(parseShard(undefined)).toBeUndefined();
	});

	test('deals items round-robin and covers every item once', () => {
		const items = ['a', 'b', 'c', 'd', 'e'];
		const parts = [1, 2, 3].map((index) => inShard(items, { index, count: 3 }));

		expect(parts).toEqual([['a', 'd'], ['b', 'e'], ['c']]);
		expect(parts.flat().toSorted()).toEqual(items);
		expect(inShard(items, undefined)).toEqual(items);
	});
});
