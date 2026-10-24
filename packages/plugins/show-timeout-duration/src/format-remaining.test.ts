import { expect, test } from 'bun:test';

import { formatRemaining } from './format-remaining';

const minute = 60_000;

test('shows the two largest units', () => {
	expect(formatRemaining((2 * 1440 + 3 * 60 + 15) * minute, 0)).toBe('2d 3h');
	expect(formatRemaining((5 * 60 + 12) * minute, 0)).toBe('5h 12m');
	expect(formatRemaining(7 * minute, 0)).toBe('7m');
});

test('drops an empty second unit', () => {
	expect(formatRemaining(2 * 1440 * minute, 0)).toBe('2d');
	expect(formatRemaining(60 * minute, 0)).toBe('1h');
});

test('rounds up to whole minutes, never below one', () => {
	expect(formatRemaining(61_000, 0)).toBe('2m');
	expect(formatRemaining(1, 0)).toBe('1m');
});
