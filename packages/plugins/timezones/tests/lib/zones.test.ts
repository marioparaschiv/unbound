import { describe, expect, test } from 'bun:test';

import {
	isTimezone,
	clockOf,
	offsetMinutes,
	readChosen,
	timeIn,
	twelveHour,
	withChosen,
} from '~/lib/zones';

const moment = new Date(Date.UTC(2026, 6, 1, 12, 5));

describe('timezones', () => {
	test('accepts the timezones the device knows and rejects the rest', () => {
		expect(isTimezone('Europe/Berlin')).toBe(true);
		expect(isTimezone(' America/New_York ')).toBe(true);
		expect(isTimezone('Mars/Olympus')).toBe(false);
		expect(isTimezone('')).toBe(false);
	});

	test('writes the time of day in a timezone, in the clock asked for', () => {
		expect(timeIn(moment, 'Europe/Berlin', false, 'en-GB')).toBe('14:05');
		expect(timeIn(moment, 'America/New_York', true, 'en-US')).toBe('8:05 AM');
	});

	test('follows the clock Discord writes its own timestamps on', () => {
		expect(clockOf('09:03')).toBe('h24');
		expect(clockOf('9:03 PM')).toBe('h12');
		expect(clockOf('Yesterday at 9:03 p.m.')).toBe('h12');
		expect(twelveHour('device', 'h24')).toBe(false);
		expect(twelveHour('device', 'h12')).toBe(true);
		expect(twelveHour('device', 'unknown')).toBeUndefined();
		expect(twelveHour('h24', 'h12')).toBe(false);
		expect(twelveHour('h12', 'h24')).toBe(true);
	});

	test('works out offsets, daylight saving included', () => {
		expect(offsetMinutes(moment, 'Europe/Berlin')).toBe(120);
		expect(offsetMinutes(new Date(Date.UTC(2026, 0, 1)), 'Europe/Berlin')).toBe(60);
		expect(offsetMinutes(moment, 'Asia/Kolkata')).toBe(330);
		expect(offsetMinutes(moment, 'UTC')).toBe(0);
	});

	test('stores one timezone per user, replacing or clearing it', () => {
		const once = withChosen([], '1', 'Europe/Berlin');
		const twice = withChosen(once, '1', 'Asia/Tokyo');

		expect(readChosen(twice).get('1')).toBe('Asia/Tokyo');
		expect(twice).toHaveLength(1);
		expect(withChosen(twice, '1', undefined)).toEqual([]);
		expect(readChosen(['broken', '=x']).size).toBe(0);
	});
});
