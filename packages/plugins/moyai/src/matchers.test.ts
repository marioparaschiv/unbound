import { describe, expect, test } from 'bun:test';

import { countMoyai, isMoyaiReaction } from './matchers';

describe('countMoyai', () => {
	test('counts Unicode and static or animated custom emoji', () => {
		expect(countMoyai('🗿 <:moai:123> <a:BigMoyai:456>')).toBe(3);
		expect(countMoyai('🗿🗿')).toBe(2);
	});

	test('ignores the word and unrelated emoji', () => {
		expect(countMoyai('moyai <:stone:123>')).toBe(0);
	});
});

describe('isMoyaiReaction', () => {
	test('matches only Moyai reaction names', () => {
		expect(isMoyaiReaction('🗿')).toBe(true);
		expect(isMoyaiReaction('BigMoyai')).toBe(true);
		expect(isMoyaiReaction('moai')).toBe(true);
		expect(isMoyaiReaction('stone')).toBe(false);
	});
});
