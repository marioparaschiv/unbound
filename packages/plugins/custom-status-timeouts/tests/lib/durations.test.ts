import { describe, expect, test } from 'bun:test';

import { durationParts, parseDurations, withDurations } from '~/lib/durations';

describe('parseDurations', () => {
	test('reads minutes, hours, days and weeks, shortest first', () => {
		expect(parseDurations('8h, 15m, 1w, 3d')).toEqual([
			900_000, 28_800_000, 259_200_000, 604_800_000,
		]);
	});

	test('skips unreadable, zero, repeated and over-long entries', () => {
		expect(parseDurations('abc, 0m, 2h, 120m, 5w, ')).toEqual([7_200_000]);
	});
});

describe('durationParts', () => {
	test('picks the largest unit that divides evenly', () => {
		expect(durationParts(604_800_000)).toEqual({ count: 1, unit: 'w' });
		expect(durationParts(259_200_000)).toEqual({ count: 3, unit: 'd' });
		expect(durationParts(5_400_000)).toEqual({ count: 90, unit: 'm' });
	});
});

describe('withDurations', () => {
	test("orders every option longest first, with 24 hours among them and Don't clear last", () => {
		expect(
			withDurations(
				['TODAY', 14_400_000, 1_800_000, 'DONT_CLEAR'],
				[900_000, 259_200_000, 1_800_000, 86_400_000],
			),
		).toEqual([259_200_000, 'TODAY', 14_400_000, 1_800_000, 900_000, 'DONT_CLEAR']);
	});
});
