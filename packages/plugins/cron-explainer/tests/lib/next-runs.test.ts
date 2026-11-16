import { describe, expect, test } from 'bun:test';

import { parseCron } from '~/lib/cron';
import { nextRuns } from '~/lib/next-runs';

const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe('next runs', () => {
	test('lists the next times in UTC', () => {
		const runs = nextRuns(
			parseCron('30 9 * * MON-FRI'),
			'UTC',
			new Date('2026-11-13T10:00:00Z'),
			3,
		);

		expect(iso(runs)).toEqual([
			'2026-11-16T09:30:00.000Z',
			'2026-11-17T09:30:00.000Z',
			'2026-11-18T09:30:00.000Z',
		]);
	});

	test('reads the schedule in the given timezone', () => {
		const runs = nextRuns(
			parseCron('0 9 * * *'),
			'America/New_York',
			new Date('2026-11-16T00:00:00Z'),
			1,
		);

		expect(iso(runs)).toEqual(['2026-11-16T14:00:00.000Z']);
	});

	test('skips a time a daylight saving jump leaves out, and runs a repeated one once', () => {
		const spring = nextRuns(
			parseCron('30 2 * * *'),
			'America/New_York',
			new Date('2026-03-07T12:00:00Z'),
			2,
		);

		expect(iso(spring)).toEqual(['2026-03-09T06:30:00.000Z', '2026-03-10T06:30:00.000Z']);

		const fall = nextRuns(
			parseCron('30 1 * * *'),
			'America/New_York',
			new Date('2026-10-31T12:00:00Z'),
			2,
		);

		expect(iso(fall)).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-02T06:30:00.000Z']);
	});

	test('finds rare dates such as the 29th of February', () => {
		const runs = nextRuns(parseCron('0 0 29 2 *'), 'UTC', new Date('2026-01-01T00:00:00Z'), 1);

		expect(iso(runs)).toEqual(['2028-02-29T00:00:00.000Z']);
	});

	test('gives up on dates that never come', () => {
		expect(
			nextRuns(parseCron('0 0 31 2 *'), 'UTC', new Date('2026-01-01T00:00:00Z'), 1),
		).toEqual([]);
	});
});
