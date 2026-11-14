import { describe, expect, test } from 'bun:test';

import { markdownRuns, type MarkdownStyle } from '~/lib/markdown';

function styled(text: string): [MarkdownStyle, string][] {
	return markdownRuns(text)
		.filter((run) => run.style !== 'marker')
		.sort((a, b) => a.start - b.start)
		.map((run) => [run.style, text.slice(run.start, run.start + run.length)]);
}

describe('markdownRuns', () => {
	test('styles inline markdown and leaves markers apart', () => {
		expect(styled('a **bold** and *it* and ~~gone~~')).toEqual([
			['bold', 'bold'],
			['italic', 'it'],
			['strike', 'gone'],
		]);
		expect(styled('__under__ ||secret||')).toEqual([
			['underline', 'under'],
			['spoiler', 'secret'],
		]);
		expect(markdownRuns('**x**').filter((run) => run.style === 'marker')).toHaveLength(2);
	});

	test('styles nothing inside code', () => {
		expect(styled('see `**not bold**` here')).toEqual([['code', '**not bold**']]);
		expect(styled('```\n*a*\n```')).toEqual([['code', '\n*a*\n']]);
	});

	test('styles headings, subtext and quotes at line starts', () => {
		expect(styled('# Title\n-# small\n> said')).toEqual([
			['heading1', 'Title'],
			['subtext', 'small'],
			['quote', 'said'],
		]);
	});

	test('skips unclosed or spaced markers', () => {
		expect(styled('**open and * spaced *')).toEqual([]);
		expect(styled('2 * 3 * 4')).toEqual([]);
	});
});
