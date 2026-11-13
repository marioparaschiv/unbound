import { describe, expect, test } from 'bun:test';

import { parseMoment, replaceTimes } from '~/lib/timestamps';

const now = new Date(2026, 10, 13, 12, 0, 0);
const seconds = (date: Date) => Math.round(date.getTime() / 1000);

describe('timestamps', () => {
	test('reads a later time as today and an earlier one as tomorrow', () => {
		expect(parseMoment('17:30', now)).toEqual(new Date(2026, 10, 13, 17, 30));
		expect(parseMoment('9:15', now)).toEqual(new Date(2026, 10, 14, 9, 15));
	});

	test('reads 12-hour times', () => {
		expect(parseMoment('5:30 PM', now)).toEqual(new Date(2026, 10, 13, 17, 30));
		expect(parseMoment('12:00AM', now)).toEqual(new Date(2026, 10, 14, 0, 0));
	});

	test('rejects text that is not a time', () => {
		expect(parseMoment('25:99', now)).toBeUndefined();
		expect(parseMoment('soon', now)).toBeUndefined();
	});

	test('replaces only backticked times when sending', () => {
		expect(replaceTimes('meet at `17:30`, not 18:00', now)).toBe(
			`meet at <t:${seconds(new Date(2026, 10, 13, 17, 30))}:t>, not 18:00`,
		);
		expect(replaceTimes('`npm i` then `99:99`', now)).toBe('`npm i` then `99:99`');
	});
});
