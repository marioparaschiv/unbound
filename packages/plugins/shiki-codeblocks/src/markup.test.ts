import { describe, expect, test } from 'bun:test';

import { buildCodeMarkup } from './markup';

describe('buildCodeMarkup', () => {
	test('numbers lines and merges adjacent runs of one color', () => {
		const markup = buildCodeMarkup(
			[
				[
					{ content: 'const ', offset: 0, color: '#c586c0', fontStyle: 0 },
					{ content: 'answer', offset: 6, color: '#9cdcfe', fontStyle: 0 },
				],
				[
					{ content: 'return ', offset: 0, color: '#c586c0', fontStyle: 0 },
					{ content: 'answer', offset: 7, color: '#9cdcfe', fontStyle: 0 },
				],
			],
			false,
		);

		expect(markup.text).toBe(' 1 const answer\n 2 return answer');
		expect(markup.spans).toEqual([
			{ color: '#858585', location: 0, length: 3 },
			{ color: '#c586c0', location: 3, length: 6 },
			{ color: '#9cdcfe', location: 9, length: 6 },
			{ color: '#858585', location: 16, length: 3 },
			{ color: '#c586c0', location: 19, length: 7 },
			{ color: '#9cdcfe', location: 26, length: 6 },
		]);
	});

	test('uses the light line-number color for light themes', () => {
		const markup = buildCodeMarkup(
			[[{ content: 'const value = 1;', offset: 0, color: '#0000ff', fontStyle: 0 }]],
			true,
		);

		expect(markup.spans).toEqual([
			{ color: '#8a8a8a', location: 0, length: 3 },
			{ color: '#0000ff', location: 3, length: 16 },
		]);
	});

	test('keeps italic, bold and underline styles apart', () => {
		const markup = buildCodeMarkup(
			[
				[
					{ content: 'alpha', offset: 0, color: '#ffffff', fontStyle: 1 },
					{ content: 'beta', offset: 5, color: '#ffffff', fontStyle: 2 },
					{ content: 'gamma', offset: 9, color: '#ffffff', fontStyle: 4 },
				],
			],
			false,
		);

		expect(markup.spans.slice(1)).toEqual([
			{ color: '#ffffff', location: 3, length: 5, fontStyle: 1 },
			{ color: '#ffffff', location: 8, length: 4, fontStyle: 2 },
			{ color: '#ffffff', location: 12, length: 5, fontStyle: 4 },
		]);
	});

	test('colors uncolored tokens with the theme foreground', () => {
		const markup = buildCodeMarkup([[{ content: 'plain', offset: 0, fontStyle: 0 }]], false);

		expect(markup.spans[1]).toEqual({ color: '#d4d4d4', location: 3, length: 5 });
	});
});
