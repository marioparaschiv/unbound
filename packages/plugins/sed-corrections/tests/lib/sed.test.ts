import { describe, expect, test } from 'bun:test';

import { applySubstitution, parseSubstitution } from '~/lib/sed';

describe('sed corrections', () => {
	test('read s/find/replace/ with flags, and nothing else', () => {
		expect(parseSubstitution('s/teh/the/')).toEqual({
			pattern: 'teh',
			replacement: 'the',
			flags: '',
		});
		expect(parseSubstitution('s/a\\/b/c/gi')).toEqual({
			pattern: 'a/b',
			replacement: 'c',
			flags: 'gi',
		});
		expect(parseSubstitution('s/typo/')).toEqual({
			pattern: 'typo',
			replacement: '',
			flags: '',
		});
		expect(parseSubstitution('s//x/')).toBeUndefined();
		expect(parseSubstitution('so/what/now')).toBeUndefined();
		expect(parseSubstitution('hello')).toBeUndefined();
	});

	test('replace the first match, or every match with g', () => {
		expect(applySubstitution('teh cat teh', parseSubstitution('s/teh/the/')!)).toBe(
			'the cat teh',
		);
		expect(applySubstitution('teh cat teh', parseSubstitution('s/teh/the/g')!)).toBe(
			'the cat the',
		);
		expect(applySubstitution('Hello', parseSubstitution('s/hello/hi/i')!)).toBe('hi');
	});

	test('use regular expressions, & and groups, and literal text when the pattern is invalid', () => {
		expect(applySubstitution('cost 5', parseSubstitution('s/(\\d)/$\\1/')!)).toBe('cost $5');
		expect(applySubstitution('cat', parseSubstitution('s/cat/[&]/')!)).toBe('[cat]');
		expect(applySubstitution('a (b', parseSubstitution('s/(b/c/')!)).toBe('a c');
	});

	test('say when nothing matched', () => {
		expect(applySubstitution('hello', parseSubstitution('s/xyz/a/')!)).toBeUndefined();
	});
});
