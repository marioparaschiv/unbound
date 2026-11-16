import { describe, expect, test } from 'bun:test';

import { describeCron } from '~/lib/describe';
import { parseCron } from '~/lib/cron';

const explain = (expression: string) => describeCron(parseCron(expression));

describe('explaining cron', () => {
	test('names the times', () => {
		expect(explain('* * * * *')).toBe('Every minute');
		expect(explain('*/15 * * * *')).toBe('Every 15 minutes');
		expect(explain('5 * * * *')).toBe('At minute 5 of every hour');
		expect(explain('0,30 9,17 * * *')).toBe('At 09:00, 09:30, 17:00, 17:30');
		expect(explain('*/5 9-17 * * *')).toBe(
			'At minutes 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 past hours 9–17',
		);
	});

	test('names the days and months', () => {
		expect(explain('30 9 * * MON-FRI')).toBe('At 09:30, on Monday–Friday');
		expect(explain('0 0 1,15 * *')).toBe('At 00:00, on day 1, 15 of the month');
		expect(explain('0 0 13 * 5')).toBe('At 00:00, on day 13 of the month or on Friday');
		expect(explain('@yearly')).toBe('At 00:00, on day 1 of the month, in January');
	});
});
