import { describe, expect, test } from 'bun:test';

import { expandCoverage, markedKeys } from '~/lib/coverage-sets';

describe('coverage sets', () => {
	test('expands each T into the five skin tones, sorted', () => {
		expect(expandCoverage('1f44d-T 1f600')).toEqual([
			'1f44d-1f3fb',
			'1f44d-1f3fc',
			'1f44d-1f3fd',
			'1f44d-1f3fe',
			'1f44d-1f3ff',
			'1f600',
		]);
		expect(expandCoverage('1f9d1-T+1f91d+1f9d1-T')).toHaveLength(25);
		expect(expandCoverage('')).toEqual([]);
	});

	test('reads a hex bitmap, highest bit first', () => {
		expect(markedKeys(['a', 'b', 'c', 'd', 'e'], 'a8')).toEqual(['a', 'c', 'e']);
		expect(markedKeys(['a', 'b'], '')).toEqual([]);
	});
});
