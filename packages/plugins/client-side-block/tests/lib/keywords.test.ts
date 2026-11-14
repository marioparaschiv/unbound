import { describe, expect, test } from 'bun:test';

import { keywordMatcher } from '~/lib/keywords';

describe('keywordMatcher', () => {
	test('matches plain keywords anywhere, ignoring case', () => {
		const matches = keywordMatcher('Spoiler\n  \nend game');

		expect(matches('no SPOILERS here')).toBe(true);
		expect(matches('the End Game is near')).toBe(true);
		expect(matches('nothing to see')).toBe(false);
	});

	test('treats slash-wrapped lines as regular expressions and skips broken ones', () => {
		const matches = keywordMatcher('/\\bfree nitro\\b/\n/([unclosed/\na.b');

		expect(matches('get FREE NITRO now')).toBe(true);
		expect(matches('freenitro')).toBe(false);
		expect(matches('a.b')).toBe(true);
		expect(matches('axb')).toBe(false);
	});

	test('matches nothing without keywords', () => {
		expect(keywordMatcher('')('anything')).toBe(false);
	});
});
