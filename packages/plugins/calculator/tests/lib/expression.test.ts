import { describe, expect, test } from 'bun:test';

import { calculation, evaluate, formatNumber, isCalculation } from '~/lib/expression';

describe('evaluating expressions', () => {
	test('follows operator precedence, powers and parentheses', () => {
		expect(evaluate('2 + 3 * 4')).toBe(14);
		expect(evaluate('(2 + 3) * 4')).toBe(20);
		expect(evaluate('2 ^ 3 ^ 2')).toBe(512);
		expect(evaluate('-2 ^ 2')).toBe(-4);
		expect(evaluate('10 % 4')).toBe(2);
		expect(evaluate('7 / 2')).toBe(3.5);
	});

	test('reads ×, ÷, −, decimals with commas, and percentages', () => {
		expect(evaluate('6 × 7')).toBe(42);
		expect(evaluate('9 ÷ 3 − 1')).toBe(2);
		expect(evaluate('1,5 * 2')).toBe(3);
		expect(evaluate('200 * 15%')).toBe(30);
	});

	test('knows functions and constants', () => {
		expect(evaluate('sqrt(16) + abs(-2)')).toBe(6);
		expect(evaluate('round(pi * 100) / 100')).toBe(3.14);
		expect(evaluate('max(1, 5, 3) + min(4, 2)')).toBe(7);
		expect(evaluate('log(1000) + ln(e)')).toBe(4);
	});

	test('rejects what it cannot calculate', () => {
		for (const bad of ['', 'hello', '2 +', '(1 + 2', 'foo(2)', '1 / 0', '2 2']) {
			expect(evaluate(bad)).toBeUndefined();
		}
	});
});

describe('spotting a calculation in a draft', () => {
	test('needs an operator or a function, and allows a trailing =', () => {
		expect(isCalculation('12 * 4')).toBe(true);
		expect(isCalculation('sqrt(2)')).toBe(true);
		expect(isCalculation('12*4 =')).toBe(true);
		expect(isCalculation('42')).toBe(false);
		expect(isCalculation('-5')).toBe(false);
		expect(isCalculation('see you at 5')).toBe(false);
	});
});

describe('formatting results', () => {
	test('trims floating point noise and long tails', () => {
		expect(formatNumber(0.1 + 0.2)).toBe('0.3');
		expect(formatNumber(1 / 3)).toBe('0.333333333333');
		expect(formatNumber(1e21)).toBe('1e+21');
	});

	test('writes the full calculation', () => {
		expect(calculation('12 * 4 =')).toEqual({ result: '48', full: '12 * 4 = 48' });
		expect(calculation('words')).toBeUndefined();
	});
});
