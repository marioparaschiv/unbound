import { describe, expect, test } from 'bun:test';

import { collapseSame, diffWords, shouldPreview, stripFences } from '~/lib/diff';

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

describe('stripFences', () => {
	test('drops fence lines with their language and keeps the code', () => {
		expect(stripFences('look:\n```ts\nconst a = 1;\n```\nok')).toBe('look:\nconst a = 1;\nok');
	});

	test('drops fences inline with the code', () => {
		expect(stripFences('```x = 1```')).toBe('x = 1');
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
