import { describe, expect, test } from 'bun:test';

import { formatDuration, parseDuration, splitDuration } from '~/lib/duration';

describe('parseDuration', () => {
	test('reads each unit and their sums', () => {
		expect(parseDuration('30s')).toBe(30_000);
		expect(parseDuration('30m')).toBe(1_800_000);
		expect(parseDuration('1D')).toBe(86_400_000);
		expect(parseDuration('1w2d12h')).toBe((9 * 24 + 12) * 3_600_000);
	});

	test('rejects words, bare numbers and zero', () => {
		expect(parseDuration('spam')).toBeUndefined();
		expect(parseDuration('10')).toBeUndefined();
		expect(parseDuration('1d spam')).toBeUndefined();
		expect(parseDuration('0m')).toBeUndefined();
	});
});

describe('formatDuration', () => {
	test('spells out each unit, largest first', () => {
		expect(formatDuration(86_400_000 + 2 * 3_600_000)).toBe('1 day, 2 hours');
		expect(formatDuration(604_800_000)).toBe('1 week');
		expect(formatDuration(500)).toBe('0 seconds');
	});
});

describe('splitDuration', () => {
	test('splits a leading duration off the reason', () => {
		expect(splitDuration(' 7d  posting  scams ')).toEqual({
			durationMs: 7 * 86_400_000,
			reason: 'posting  scams',
		});
		expect(splitDuration('7d')).toEqual({ durationMs: 7 * 86_400_000 });
	});

	test('keeps the whole text as the reason without a duration', () => {
		expect(splitDuration('spam links')).toEqual({ reason: 'spam links' });
		expect(splitDuration('  ')).toEqual({});
	});
});
