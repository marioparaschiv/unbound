import { describe, expect, test } from 'bun:test';

import {
	codeSlots,
	placeholderOffsets,
	placeholderTexts,
	renderedText,
	sourceBlock,
} from './code-ranges';

describe('android code blocks', () => {
	const text = 'fresh shiki fixture\nconst answer = 42;\nconsole.log(answer); \n​';

	test('keeps the newline that ends a block out of the replaced range', () => {
		expect(codeSlots(text, [{ start: 20, end: 61 }])).toEqual([
			{
				start: 20,
				end: 60,
				blockEnd: 61,
				code: 'const answer = 42;\nconsole.log(answer);',
			},
		]);
	});

	test('ignores empty, out-of-range and overlapping blocks', () => {
		expect(
			codeSlots(text, [
				{ start: 59, end: 61 },
				{ start: 10, end: 400 },
			]),
		).toEqual([]);
		expect(
			codeSlots(text, [
				{ start: 20, end: 61 },
				{ start: 30, end: 40 },
			]).map(({ start }) => start),
		).toEqual([20]);
	});

	test('orders blocks by position', () => {
		const two = 'a\nfirst \nb\nsecond \n';

		expect(
			codeSlots(two, [
				{ start: 11, end: 19 },
				{ start: 2, end: 9 },
			]).map(({ code }) => code),
		).toEqual(['first', 'second']);
	});

	test('places each placeholder after the replacements before it', () => {
		expect(
			placeholderOffsets([
				{ start: 2, end: 8 },
				{ start: 11, end: 19 },
			]),
		).toEqual([2, 6]);
	});

	test('renders messages that differ only in their code to different text', () => {
		const slots = [
			{ start: 0, end: 5 },
			{ start: 6, end: 11 },
		];
		const html = renderedText('aaaaa\nbbbbb', slots);
		const zig = renderedText('ccccc\nddddd', slots);

		expect(html).not.toBe(zig);
		expect(html.startsWith('\ufffc\n\ufffc')).toBe(true);
		expect(html.slice(3)).toMatch(/^(?:\u200b|\u200c|\u200d|\u2060)+$/);
		expect(renderedText('aaaaa\nbbbbb', slots)).toBe(html);
	});

	test('tags only the last placeholder, so earlier offsets stay put', () => {
		const slots = [
			{ start: 2, end: 8 },
			{ start: 11, end: 19 },
		];
		const original = 'a\n123456\nb\n12345678';
		const rendered = renderedText(original, slots);
		const offsets = placeholderOffsets(slots);

		expect(placeholderTexts(original, slots)[0]).toBe('\ufffc');
		expect(offsets.map((offset) => rendered[offset])).toEqual(['\ufffc', '\ufffc']);
	});

	test('matches a rendered block to its fence', () => {
		const blocks = [
			{ code: 'one', language: 'ts' },
			{ code: 'two', language: 'js' },
		];

		expect(sourceBlock('two', blocks)?.language).toBe('js');
		expect(sourceBlock(' one ', blocks)?.language).toBe('ts');
		expect(sourceBlock('three', blocks)).toBeUndefined();
	});
});

test('matches a slot whose tabs Discord rendered as spaces', () => {
	const block = { code: 'function f() {\n\treturn 1;\n}', language: 'typescript' };

	expect(sourceBlock('function f() {\n    return 1;\n}', [block])?.language).toBe('typescript');
});
