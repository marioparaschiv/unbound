import { describe, expect, test } from 'bun:test';

import { applyRules, normalizeRules, stringToRegex, type TextReplaceRule } from './rules';

function rule(find: string, replace: string, onlyIfIncludes: string = ''): TextReplaceRule {
	return { find, replace, onlyIfIncludes, id: find };
}

describe('applyRules', () => {
	test('applies literal replacements at every position', () => {
		expect(applyRules('cat cat', [rule('cat', 'dog')], [])).toBe('dog dog');
	});

	test('respects only-if-includes conditions', () => {
		expect(applyRules('hello world', [rule('world', 'earth', 'hello')], [])).toBe(
			'hello earth',
		);
		expect(applyRules('goodbye world', [rule('world', 'earth', 'hello')], [])).toBe(
			'goodbye world',
		);
	});

	test('converts escaped newlines in replacements', () => {
		expect(applyRules('hello', [rule('hello', 'hi\\nthere')], [])).toBe('hi\nthere');
	});

	test('applies slash-delimited regexes with their flags', () => {
		expect(applyRules('Cat cat', [], [rule('/cat/gi', 'dog')])).toBe('dog dog');
	});

	test('keeps content unchanged when a regex is invalid', () => {
		expect(applyRules('hello', [], [rule('/[/', 'goodbye')])).toBe('hello');
	});
});

test('stringToRegex deduplicates flags and defaults to global', () => {
	expect(stringToRegex('/cat/ggi').flags).toBe('gi');
	expect(stringToRegex('cat').flags).toBe('g');
});

test('normalizeRules fills missing fields and falls back to one empty rule', () => {
	expect(normalizeRules([{ find: 'a', id: 'x' }])).toEqual([
		{ find: 'a', replace: '', onlyIfIncludes: '', id: 'x' },
	]);
	expect(normalizeRules(undefined)).toEqual([
		{ find: '', replace: '', onlyIfIncludes: '', id: expect.any(String) },
	]);
});
