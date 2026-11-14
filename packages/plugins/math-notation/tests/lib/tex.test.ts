import { describe, expect, test } from 'bun:test';

import { convertMessage } from '~/lib/messages';
import { convert } from '~/lib/tex';

describe('convert', () => {
	test('turns commands, scripts and fractions into Unicode', () => {
		expect(convert('x^2 + y_1 \\leq \\pi')).toBe('x² + y₁ ≤ π');
		expect(convert('\\frac{a+b}{2}')).toBe('(a+b)/2');
		expect(convert('\\sqrt{x} + \\sqrt[3]{y}')).toBe('√x + ³√y');
		expect(convert('\\forall x \\in \\mathbb{R}')).toBe('∀ x ∈ ℝ');
		expect(convert('e^{i\\pi} + 1 = 0')).toBe('e^(iπ) + 1 = 0');
		expect(convert('\\sum_{i=1}^{n} i')).toBe('∑ᵢ₌₁ⁿ i');
	});

	test('keeps unknown commands and handles text and delimiters', () => {
		expect(convert('\\unknown{x}')).toBe('\\unknownx');
		expect(convert('\\text{if } x > 0')).toBe('if x > 0');
		expect(convert('\\left( \\frac{1}{x} \\right)')).toBe('( 1/x )');
	});
});

describe('convertMessage', () => {
	test('converts every delimiter style', () => {
		expect(convertMessage('area is $\\pi r^2$ ok')).toBe('area is π r² ok');
		expect(convertMessage('\\(a^2 + b^2 = c^2\\)')).toBe('a² + b² = c²');
		expect(convertMessage('$$\\int_0^1 x dx$$')).toBe('∫₀¹ x dx');
	});

	test('leaves prices, code and links alone', () => {
		expect(convertMessage('it costs $5 and $10')).toBe('it costs $5 and $10');
		expect(convertMessage('`$x^2$` and https://x.test/$a^b$')).toBe(
			'`$x^2$` and https://x.test/$a^b$',
		);
	});
});
