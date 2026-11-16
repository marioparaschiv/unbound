import { format, messages } from '@unbound-app/i18n';

import type { Cron, CronField } from '~/lib/cron';

const MAX_LISTED_TIMES = 12;
const NAME_YEAR = 2023;

function runs(values: number[]): string[] {
	const parts: string[] = [];
	let start = 0;

	for (let index = 1; index <= values.length; index++) {
		if (index < values.length && values[index] === values[index - 1]! + 1) continue;

		const from = values[start]!;
		const to = values[index - 1]!;

		parts.push(to - from >= 2 ? `${from}–${to}` : from === to ? `${from}` : `${from}, ${to}`);
		start = index;
	}

	return parts;
}

function weekdayName(value: number): string {
	return new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
		new Date(Date.UTC(NAME_YEAR, 0, 1 + value)),
	);
}

function monthName(value: number): string {
	return new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(
		new Date(Date.UTC(NAME_YEAR, value - 1, 1)),
	);
}

function namedList(field: CronField, name: (value: number) => string): string {
	return runs([...field.values])
		.map((part) => part.replace(/\d+/g, (value) => name(Number(value))))
		.join(', ');
}

function numberList(field: CronField): string {
	return runs([...field.values]).join(', ');
}

function minuteStep(field: CronField): number | undefined {
	const match = /^\*\/(\d+)$/.exec(field.source);

	return match ? Number(match[1]) : undefined;
}

function clock(hour: number, minute: number): string {
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timePart({ minute, hour }: Cron): string {
	const step = minuteStep(minute);

	if (minute.any && hour.any) return messages.EVERY_MINUTE;
	if (step && hour.any) return format('EVERY_N_MINUTES', { n: step });
	if (hour.any && minute.values.size === 1) {
		return format('AT_MINUTE_EVERY_HOUR', { minute: [...minute.values][0]! });
	}

	if (hour.any) return format('AT_MINUTES_EVERY_HOUR', { minutes: numberList(minute) });

	if (minute.values.size * hour.values.size <= MAX_LISTED_TIMES) {
		const times = [...hour.values].flatMap((h) => [...minute.values].map((m) => clock(h, m)));

		return format('AT_TIMES', { times: times.join(', ') });
	}

	return format('AT_MINUTES_HOURS', { minutes: numberList(minute), hours: numberList(hour) });
}

function dayPart({ day, weekday }: Cron): string | undefined {
	const weekdays = namedList(weekday, weekdayName);

	if (day.any && weekday.any) return undefined;
	if (day.any) return format('ON_WEEKDAYS', { weekdays });
	if (weekday.any) return format('ON_MONTH_DAYS', { days: numberList(day) });

	return format('ON_MONTH_DAYS_OR_WEEKDAYS', { days: numberList(day), weekdays });
}

function monthPart({ month }: Cron): string | undefined {
	return month.values.size === 12
		? undefined
		: format('IN_MONTHS', { months: namedList(month, monthName) });
}

/**
 * @description Explains a cron in one sentence, such as "At 09:30, on Monday–Friday".
 * @param cron The cron.
 * @returns The explanation.
 */
export function describeCron(cron: Cron): string {
	return [timePart(cron), dayPart(cron), monthPart(cron)].filter(Boolean).join(', ');
}

export default { describeCron };
