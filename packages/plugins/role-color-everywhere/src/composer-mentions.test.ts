import { describe, expect, test } from 'bun:test';

import { composerMentions } from './composer-mentions';

const aliases = {
	owners: new Map([
		['Ann Lee', 'u1'],
		['Ann', 'u2'],
		['dylib.dev', 'u3'],
	]),
	names: ['dylib.dev', 'Ann Lee', 'Ann'],
};

describe('composerMentions', () => {
	test('finds each mention and its member', () => {
		expect(composerMentions('hi @dylib.dev and @Ann', aliases)).toEqual([
			{ start: 3, end: 13, userId: 'u3' },
			{ start: 18, end: 22, userId: 'u2' },
		]);
	});

	test('prefers the longest name', () => {
		expect(composerMentions('@Ann Lee!', aliases)).toEqual([
			{ start: 0, end: 8, userId: 'u1' },
		]);
	});

	test('skips text that only starts like a name', () => {
		expect(composerMentions('@Annabel @nobody', aliases)).toEqual([]);
	});
});
