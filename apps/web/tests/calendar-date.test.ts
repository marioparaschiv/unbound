import { afterAll, describe, expect, test } from 'bun:test';

import { formatCalendarDate, parseCalendarDate } from '~/lib/calendar-date';

const ORIGINAL_TZ = process.env.TZ;

const ZONES_EITHER_SIDE_OF_UTC: [zone: string, januaryOffset: number][] = [
	['America/Los_Angeles', 480],
	['Asia/Tokyo', -540],
	['UTC', 0],
];

const DAYS = ['2026-01-12', '2026-02-03', '2024-02-29', '2026-03-08', '2026-12-31', '0099-06-15'];

afterAll(() => {
	if (ORIGINAL_TZ === undefined) {
		delete process.env.TZ;
	} else {
		process.env.TZ = ORIGINAL_TZ;
	}
});

describe.each(ZONES_EITHER_SIDE_OF_UTC)('calendar dates in %s', (zone, januaryOffset) => {
	test('the zone is in effect', () => {
		process.env.TZ = zone;

		expect(new Date(2026, 0, 12).getTimezoneOffset()).toBe(januaryOffset);
	});

	test('a parsed day shows the same local year, month and day', () => {
		process.env.TZ = zone;

		const date = parseCalendarDate('2026-01-12');

		expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 0, 12]);
	});

	test('a day the calendar picks writes as that day', () => {
		process.env.TZ = zone;

		expect(formatCalendarDate(new Date(2026, 1, 3))).toBe('2026-02-03');
		expect(formatCalendarDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
	});

	test('every day survives a round trip', () => {
		process.env.TZ = zone;

		for (const day of DAYS) {
			expect(formatCalendarDate(parseCalendarDate(day))).toBe(day);
		}
	});
});
