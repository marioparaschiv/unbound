import { describe, expect, test } from 'bun:test';

import { skewPhrase } from '~/debug-card-clock';

describe('skewPhrase', () => {
	test('uses the largest unit that fits', () => {
		expect(skewPhrase(3)).toBe('in sync');
		expect(skewPhrase(-40)).toBe('40 s behind');
		expect(skewPhrase(300)).toBe('5 min ahead');
		expect(skewPhrase(-10_800)).toBe('3 h behind');
		expect(skewPhrase(864_000)).toBe('10 d ahead');
	});
});
