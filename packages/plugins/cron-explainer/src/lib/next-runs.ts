import { matchesDay, type Cron } from '~/lib/cron';

const SEARCH_DAYS = 366 * 8;
const MINUTE = 60_000;
const DAY = 86_400_000;

type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

function wallClock(timeZone: string): (instant: number) => WallTime {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	});

	return (instant) => {
		const parts = Object.fromEntries(
			formatter
				.formatToParts(new Date(instant))
				.map((part) => [part.type, Number(part.value)]),
		);

		return {
			year: parts.year!,
			month: parts.month!,
			day: parts.day!,
			hour: parts.hour! % 24,
			minute: parts.minute!,
		};
	};
}

function asUtc({ year, month, day, hour, minute }: WallTime): number {
	return Date.UTC(year, month - 1, day, hour, minute);
}

function sameWallTime(a: WallTime, b: WallTime): boolean {
	return (
		a.year === b.year &&
		a.month === b.month &&
		a.day === b.day &&
		a.hour === b.hour &&
		a.minute === b.minute
	);
}

function instantOf(wall: WallTime, clock: (instant: number) => WallTime): number | undefined {
	const guess = asUtc(wall);
	const candidates = [-14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14]
		.map((hours) => guess - hours * 3_600_000)
		.map((instant) => instant + (asUtc(wall) - asUtc(clock(instant))))
		.filter((instant) => sameWallTime(clock(instant), wall));

	return candidates.length ? Math.min(...candidates) : undefined;
}

/**
 * @description Lists the next times a cron runs, reading its schedule as wall-clock time in a timezone. A time that a
 * daylight saving change skips does not run, and a time it repeats runs once, at its first occurrence.
 * @param cron The cron.
 * @param timeZone An IANA timezone, such as `Europe/Berlin`.
 * @param after Only times after this one count.
 * @param count How many times to list.
 * @returns Up to `count` times, earliest first; fewer when the cron never runs within eight years.
 */
export function nextRuns(cron: Cron, timeZone: string, after: Date, count: number): Date[] {
	const clock = wallClock(timeZone);
	const start = clock(after.getTime());
	const firstDay = Date.UTC(start.year, start.month - 1, start.day);
	const runs: Date[] = [];

	for (let offset = 0; offset < SEARCH_DAYS && runs.length < count; offset++) {
		const date = new Date(firstDay + offset * DAY);
		const day = {
			day: date.getUTCDate(),
			month: date.getUTCMonth() + 1,
			weekday: date.getUTCDay(),
		};

		if (!matchesDay(cron, day)) continue;

		for (const hour of cron.hour.values) {
			for (const minute of cron.minute.values) {
				const wall = {
					year: date.getUTCFullYear(),
					month: day.month,
					day: day.day,
					hour,
					minute,
				};

				if (offset === 0 && asUtc(wall) < asUtc(start)) continue;

				const instant = instantOf(wall, clock);

				if (instant === undefined || instant < after.getTime() + MINUTE / 2) continue;

				runs.push(new Date(instant));

				if (runs.length === count) return runs;
			}
		}
	}

	return runs;
}

export default { nextRuns };
