import type { TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { expect, test } from 'bun:test';

import { parseRuleset, serializeRuleset } from './ruleset';

function rule(find: string, replace: string, onlyIfIncludes: string = ''): TextReplaceRule {
	return { find, replace, onlyIfIncludes, id: find };
}

test('round-trips a ruleset without sharing internal ids', () => {
	const source = rule('cat', 'dog', 'pets');
	const encoded = serializeRuleset({
		stringRules: [source],
		regexRules: [rule('/woof/gi', 'bark')],
	});
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
	const encoded = serializeRuleset({
		stringRules: [
			rule('oginstagram.com', 'ddinstagram.com'),
			rule('<timer:seconds>', '<timer:milliseconds>'),
		],
		regexRules: [],
	});

	expect(JSON.parse(encoded)).toEqual({
		version: 1,
		stringRules: [
			{ find: 'oginstagram.com', replace: 'ddinstagram.com', onlyIfIncludes: '' },
			{ find: '<timer:seconds>', replace: '<timer:milliseconds>', onlyIfIncludes: '' },
		],
		regexRules: [],
	});
});

test('drops blank rules on export and import', () => {
	const encoded = serializeRuleset({ stringRules: [rule('', '')], regexRules: [] });

	expect(JSON.parse(encoded).stringRules).toEqual([]);
	expect(parseRuleset(encoded)).toEqual({ stringRules: [], regexRules: [] });
});

test('rejects unsupported rulesets', () => {
	expect(() => parseRuleset('{"version":2,"stringRules":[],"regexRules":[]}')).toThrow(
		'unsupported',
	);
	expect(() => parseRuleset('not json')).toThrow('valid JSON');
	expect(() => parseRuleset('null')).toThrow('not a Text Replace ruleset');
});
