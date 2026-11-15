import { format } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { durationParts } from '~/lib/durations';

const UNIT_KEYS = { m: 'MINUTES', h: 'HOURS', d: 'DAYS', w: 'WEEKS' } as const;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

type Moment = { format(pattern: string): string; calendar(): string };

const moment = metro.findByProps('calendarFormat', 'momentProperties', { lazy: true }) as
	| { unix(seconds: number): Moment }
	| undefined;

/**
 * @description Names a duration, like `8 hours`.
 * @param ms The duration in milliseconds.
 * @returns The duration's name.
 */
export function durationName(ms: number): string {
	const { count, unit } = durationParts(ms);

	return format(UNIT_KEYS[unit], { count });
}

/**
 * @description Names when a status set now with this duration clears, in Discord's own date style: a time, a weekday, or a date.
 * @param ms The duration in milliseconds.
 * @param now The current time.
 * @returns The clear time.
 */
export function clearTime(ms: number, now = Date.now()): string {
	const end = now + ms;
	const date = moment?.unix?.(end / 1000);

	if (!date) return new Date(end).toLocaleString();
	if (ms < DAY_MS) return date.format('LT');

	return ms < WEEK_MS ? date.calendar() : date.format('lll');
}
