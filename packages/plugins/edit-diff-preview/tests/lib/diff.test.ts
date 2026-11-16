import { describe, expect, test } from 'bun:test';

import { collapseSame, diffWords, shouldPreview } from '~/lib/diff';

describe('diffWords', () => {
	test('marks changed words and keeps the rest', () => {
		expect(diffWords('the quick brown fox', 'the slow brown fox jumps')).toEqual([
			{ kind: 'same', text: 'the ' },
			{ kind: 'removed', text: 'quick' },
			{ kind: 'added', text: 'slow' },
			{ kind: 'same', text: ' brown fox' },
			{ kind: 'added', text: ' jumps' },
		]);
	});

	test('rebuilds both texts from its parts', () => {
		const before = 'a b c d e\nline two';
		const after = 'a c d x e\nline 2';
		const parts = diffWords(before, after);

		expect(
			parts
				.filter((part) => part.kind !== 'added')
				.map((part) => part.text)
				.join(''),
		).toBe(before);
		expect(
			parts
				.filter((part) => part.kind !== 'removed')
				.map((part) => part.text)
				.join(''),
		).toBe(after);
	});
});

describe('collapseSame', () => {
	test('shortens long unchanged stretches around changes', () => {
		const parts = collapseSame(
			[
				{ kind: 'same', text: 'x'.repeat(100) },
				{ kind: 'added', text: 'new' },
			],
			5,
		);

		expect(parts[0]?.text).toBe('…xxxxx');
	});
});

describe('shouldPreview', () => {
	test('asks for long messages and code, not short edits', () => {
		const options = { minLength: 20, code: true };

		expect(shouldPreview('short', 'shorter', options)).toBe(false);
		expect(shouldPreview('a'.repeat(20), 'b', options)).toBe(true);
		expect(shouldPreview('```x```', '```y```', options)).toBe(true);
		expect(shouldPreview('same', 'same', { minLength: 0, code: true })).toBe(false);
	});
});
