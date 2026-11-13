import { describe, expect, test } from 'bun:test';

import { formatDate, isSameDay, toDate } from '~/lib/format';

const date = new Date(2026, 10, 3, 9, 5, 7);

describe('custom timestamps', () => {
	test('fills every token', () => {
		expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-11-03 09:05:07');
		expect(formatDate(date, 'D/M/YY h:mm A')).toBe('3/11/26 9:05 AM');
		expect(formatDate(new Date(2026, 10, 3, 21, 0), 'hh:mm a')).toBe('09:00 pm');
	});

	test('names months and weekdays and keeps bracketed text', () => {
		expect(formatDate(date, 'ddd, D MMM [at] HH:mm', 'en-US')).toBe('Tue, 3 Nov at 09:05');
	});

	test('tells today from other days and reads Discord timestamps', () => {
		expect(isSameDay(date, new Date(2026, 10, 3, 23, 59))).toBe(true);
		expect(isSameDay(date, new Date(2026, 10, 4))).toBe(false);
		expect(toDate({ valueOf: () => date.getTime() })?.getTime()).toBe(date.getTime());
		expect(toDate('2026-11-03T09:05:07.000Z')).toBeInstanceOf(Date);
		expect(toDate({})).toBeUndefined();
	});
});
