import { describe, expect, test } from 'bun:test';

import { CODE_LINE_HEIGHT, codeBlockLayout, codeScrollHeight, shouldCorrectRow } from './layout';

describe('codeBlockLayout', () => {
	test('keeps long lines on one row in horizontal-scroll mode', () => {
		const code = `const result = ${'item + '.repeat(20)}42;\nreturn result;`;
		const wrapped = codeBlockLayout(code, 240, 'wrap');
		const scrolled = codeBlockLayout(code, 240, 'scroll');

		expect(scrolled.height).toBeLessThan(wrapped.height);
		expect(scrolled.contentWidth).toBeGreaterThan((code.split('\n')[0].length + 3) * 8);
	});

	test('sizes the code to its lines so the card leaves no gap above them', () => {
		const code = Array.from({ length: 8 }, (_, index) => `line ${index}`).join('\n');
		const layout = codeBlockLayout(code, 320, 'wrap');

		expect(layout.contentHeight).toBe(Math.ceil(2 + 8 * CODE_LINE_HEIGHT));
		expect(layout.height).toBe(50 + layout.contentHeight);
	});

	test('wraps a line only when it does not fit beside the line numbers', () => {
		const code = [
			'const answer: number = 42;',
			'function double(value: number) {',
			'    return value * 2;',
			'}',
		].join('\n');

		expect(codeBlockLayout(code, 291, 'wrap').contentHeight).toBe(
			Math.ceil(2 + 4 * CODE_LINE_HEIGHT),
		);
	});

	test('caps the card height and leaves the overflow to scroll', () => {
		const code = Array.from({ length: 36 }, (_, index) => `print(${index + 1})`).join('\n');
		const layout = codeBlockLayout(code, 240, 'wrap');

		expect(layout.height).toBe(520);
		expect(layout.contentHeight).toBeGreaterThan(layout.height - 50);
	});
});

describe('codeScrollHeight', () => {
	test('fits the measured code but never shrinks below the viewport', () => {
		expect(codeScrollHeight(516, 470)).toBe(518);
		expect(codeScrollHeight(28, 38)).toBe(38);
	});
});

describe('shouldCorrectRow', () => {
	test('corrects a row only when its label extends past it', () => {
		expect(shouldCorrectRow(217.5, 217.5, 257.5)).toBe(true);
		expect(shouldCorrectRow(257.5, 257.5, 257.5)).toBe(false);
	});
});
