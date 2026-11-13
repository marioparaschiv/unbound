import type { TimestampStyle } from '~/lib/timestamps';

export type PreviewFormat = { locale?: string; timeZone?: string };

type Unit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

const UNITS: [Unit, number][] = [
	['year', 365 * 24 * 60 * 60],
	['month', 30 * 24 * 60 * 60],
	['day', 24 * 60 * 60],
	['hour', 60 * 60],
	['minute', 60],
	['second', 1],
];

const TIME = { hour: '2-digit', minute: '2-digit' } as const;
const LONG_DATE = { day: 'numeric', month: 'long', year: 'numeric' } as const;

const STYLES: Record<Exclude<TimestampStyle, 'R'>, Intl.DateTimeFormatOptions> = {
	t: TIME,
	T: { ...TIME, second: '2-digit' },
	d: { day: '2-digit', month: '2-digit', year: 'numeric' },
	D: LONG_DATE,
	f: { ...LONG_DATE, ...TIME },
	F: { weekday: 'long', ...LONG_DATE, ...TIME },
};

function englishRelative(value: number, unit: Unit): string {
	const count = Math.abs(value);
	const units = `${count} ${unit}${count === 1 ? '' : 's'}`;

	return value < 0 ? `${units} ago` : `in ${units}`;
}

/**
 * @description Words a time difference in its largest whole unit, such as `in 2 hours` or `3 days ago`.
 * @param seconds How far away the moment is, negative for the past.
 * @param locale The language to word it in.
 * @returns The relative time.
 */
export function relativeTime(seconds: number, locale?: string): string {
	const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? UNITS.at(-1)!;
	const value = Math.round(seconds / size);

	if (typeof Intl.RelativeTimeFormat !== 'function') return englishRelative(value, unit);

	return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(value, unit);
}

/**
 * @description Shows how Discord draws a timestamp in a style, for picking one.
 * @param moment The moment.
 * @param style How Discord draws it.
 * @param now The current time, for the relative style.
 * @param format The language and time zone, the device's own by default.
 * @returns The timestamp as it reads in chat.
 */
export function previewTimestamp(
	moment: Date,
	style: TimestampStyle,
	now: Date = new Date(),
	{ locale, timeZone }: PreviewFormat = {},
): string {
	if (style === 'R') return relativeTime((moment.getTime() - now.getTime()) / 1000, locale);

	return moment.toLocaleString(locale, { ...STYLES[style], timeZone });
}
