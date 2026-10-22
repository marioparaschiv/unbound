import { expect, test } from 'bun:test';

import {
	applyRules,
	parseRuleset,
	serializeRuleset,
	stringToRegex,
	type TextReplaceRule,
} from '@text-replace/rules';

function rule(find: string, replace: string, onlyIfIncludes: string = ''): TextReplaceRule {
	return { find, replace, onlyIfIncludes, id: find };
}

test('applies literal replacements at every position', () => {
	expect(applyRules('cat cat', [rule('cat', 'dog')], [])).toBe('dog dog');
});

test('respects only-if-includes conditions', () => {
	expect(applyRules('hello world', [rule('world', 'earth', 'hello')], [])).toBe('hello earth');
	expect(applyRules('goodbye world', [rule('world', 'earth', 'hello')], [])).toBe(
		'goodbye world',
	);
});

test('converts escaped newlines in replacements', () => {
	expect(applyRules('hello', [rule('hello', 'hi\\nthere')], [])).toBe('hi\nthere');
});

test('accepts slash-delimited regexes and deduplicates flags', () => {
	expect(stringToRegex('/cat/ggi').flags).toBe('gi');
	expect(applyRules('Cat cat', [], [rule('/cat/gi', 'dog')])).toBe('dog dog');
});

test('keeps content unchanged when a regex is invalid', () => {
	expect(applyRules('hello', [], [rule('/[/', 'goodbye')])).toBe('hello');
});

test('round-trips a ruleset without sharing internal ids', () => {
	const source = rule('cat', 'dog', 'pets');
	const encoded = serializeRuleset([source], [rule('/woof/gi', 'bark')]);
	const decoded = parseRuleset(encoded);

	expect(decoded.stringRules).toEqual([
		{ find: 'cat', replace: 'dog', onlyIfIncludes: 'pets', id: expect.any(String) },
	]);
	expect(decoded.regexRules).toEqual([
		{ find: '/woof/gi', replace: 'bark', onlyIfIncludes: '', id: expect.any(String) },
	]);
	expect(decoded.stringRules[0]?.id).not.toBe(source.id);
});

test('exports each replacement value independently from its find value', () => {
	const encoded = serializeRuleset(
		[
			rule('oginstagram.com', 'ddinstagram.com'),
			rule('<timer:seconds>', '<timer:milliseconds>'),
		],
		[],
	);

	expect(JSON.parse(encoded)).toEqual({
		version: 1,
		stringRules: [
			{ find: 'oginstagram.com', replace: 'ddinstagram.com', onlyIfIncludes: '' },
			{ find: '<timer:seconds>', replace: '<timer:milliseconds>', onlyIfIncludes: '' },
		],
		regexRules: [],
	});
});

test('rejects unsupported rulesets', () => {
	expect(() => parseRuleset('{"version":2,"stringRules":[],"regexRules":[]}')).toThrow(
		'unsupported',
	);
	expect(() => parseRuleset('not json')).toThrow('valid JSON');
});
