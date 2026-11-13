import { describe, expect, test } from 'bun:test';

import { xxHash64 } from '~/lib/xxhash64';

const samples = [
	'',
	'a',
	'224617799434108928',
	'224617799434108928seed',
	'x'.repeat(31),
	'y'.repeat(32),
	'z'.repeat(77),
	'żółć',
];

describe('xxHash64', () => {
	test('matches Bun for short, long and multi-byte strings', () => {
		for (const sample of samples) {
			expect(xxHash64(sample)).toBe(Bun.hash.xxHash64(sample));
		}
	});
});
