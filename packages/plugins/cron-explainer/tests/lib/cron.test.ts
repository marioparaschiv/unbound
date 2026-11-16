import { describe, expect, test } from 'bun:test';

import { CronError, matchesDay, parseCron } from '~/lib/cron';

describe('parsing cron', () => {
	test('reads lists, ranges, steps and names', () => {
		const cron = parseCron('*/15 9-17 * JAN,jul MON-FRI');

		expect([...cron.minute.values]).toEqual([0, 15, 30, 45]);
		expect([...cron.hour.values]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
		expect([...cron.month.values]).toEqual([1, 7]);
		expect([...cron.weekday.values]).toEqual([1, 2, 3, 4, 5]);
		expect(cron.day.any).toBe(true);
	});

	test('treats 7 as Sunday and expands macros', () => {
		expect([...parseCron('0 0 * * 7').weekday.values]).toEqual([0]);
		expect(parseCron('@daily').source).toBe('0 0 * * *');
		expect([...parseCron('@weekly').weekday.values]).toEqual([0]);
	});

	test('rejects broken expressions', () => {
		for (const bad of [
			'',
			'* * * *',
			'60 * * * *',
			'* 24 * * *',
			'* * 0 * *',
			'*/0 * * * *',
			'5-1 * * * *',
			'a * * * *',
			'@sometimes',
		]) {
			expect(() => parseCron(bad)).toThrow(CronError);
		}
	});
});

describe('matching days', () => {
	test('either the day of the month or the weekday matches when both are set', () => {
		const cron = parseCron('0 0 13 * FRI');

		expect(matchesDay(cron, { day: 13, month: 6, weekday: 2 })).toBe(true);
		expect(matchesDay(cron, { day: 20, month: 6, weekday: 5 })).toBe(true);
		expect(matchesDay(cron, { day: 20, month: 6, weekday: 4 })).toBe(false);
	});

	test('only the set field counts when the other is *', () => {
		const cron = parseCron('0 0 * 2 1');

		expect(matchesDay(cron, { day: 3, month: 2, weekday: 1 })).toBe(true);
		expect(matchesDay(cron, { day: 3, month: 3, weekday: 1 })).toBe(false);
		expect(matchesDay(cron, { day: 4, month: 2, weekday: 2 })).toBe(false);
	});
});
