import { describe, expect, test } from 'bun:test';

import { clearTagProblems, noteTag, tagProblem, tagProblems } from '~/tag-problems';

describe('tag problems', () => {
	test('flags tags without text or with unreadable colors', () => {
		expect(tagProblem('Owner', { background: 1, text: 2 })).toBeUndefined();
		expect(tagProblem('  ', undefined)).toBe('has no text');
		expect(tagProblem('Mod', { background: 3, text: 3 })).toBe(
			'has text the same color as its background',
		);
	});

	test('keeps only the latest problem for each message', () => {
		clearTagProblems();
		noteTag('1', 'has no text');
		noteTag('2', 'has no text');
		noteTag('1', undefined);

		expect(tagProblems()).toEqual(['2 has no text']);
	});
});
