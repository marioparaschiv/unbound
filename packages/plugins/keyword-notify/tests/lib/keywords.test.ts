import { describe, expect, test } from 'bun:test';

import { createKeywordMatcher, type KeywordOptions } from '~/lib/keywords';

const plain: KeywordOptions = {
	keywords: ['unbound', ' '],
	regex: false,
	caseSensitive: false,
	wholeWords: true,
};

describe('keyword matcher', () => {
	test('matches whole words in any case by default', () => {
		const matches = createKeywordMatcher(plain);

		expect(matches('who broke Unbound again')).toBe(true);
		expect(matches('unbounded joy')).toBe(false);
		expect(matches('nothing here')).toBe(false);
	});

	test('matches inside words and by case when asked', () => {
		const matches = createKeywordMatcher({ ...plain, wholeWords: false, caseSensitive: true });

		expect(matches('unbounded joy')).toBe(true);
		expect(matches('Unbounded joy')).toBe(false);
	});

	test('reads regular expressions and skips invalid ones', () => {
		const matches = createKeywordMatcher({
			...plain,
			regex: true,
			keywords: ['v\\d+\\.\\d+', '(broken'],
		});

		expect(matches('loader v1.6 is out')).toBe(true);
		expect(matches('(broken')).toBe(false);
	});

	test('treats regex characters literally without the regex option', () => {
		expect(
			createKeywordMatcher({ ...plain, keywords: ['c++'], wholeWords: false })('I like c++'),
		).toBe(true);
	});
});
