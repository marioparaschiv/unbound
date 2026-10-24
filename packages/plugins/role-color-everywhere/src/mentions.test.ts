import { describe, expect, test } from 'bun:test';

import { longestFirst, matchMention, mentionedUserIds } from '~/mentions';

test('mentionedUserIds reads both user mention forms', () => {
	expect(mentionedUserIds('hi <@123> and <@!456>, not <#789>')).toEqual(['123', '456']);
});

describe('matchMention', () => {
	const names = longestFirst(['Ann', 'Ann Lee']);
	const boundary = /[\s,.!?;:]/u;

	test('prefers the longest name that fits', () => {
		expect(matchMention('hey @Ann Lee!', 4, names, boundary)).toBe('Ann Lee');
		expect(matchMention('hey @Ann, hi', 4, names, boundary)).toBe('Ann');
	});

	test('needs a boundary after the name', () => {
		expect(matchMention('@Annie', 0, names, boundary)).toBeUndefined();
		expect(matchMention('@Ann', 0, names, boundary)).toBe('Ann');
	});

	test('accepts the isolate marks Discord wraps native mentions in', () => {
		expect(matchMention('@Ann\u2069 hi', 0, names, /[\s\u2068\u2069]/u)).toBe('Ann');
	});
});
