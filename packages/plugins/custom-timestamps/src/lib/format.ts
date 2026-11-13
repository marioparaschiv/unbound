const TOKENS = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|A|a/g;

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function name(date: Date, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * @description Writes a date with a pattern of tokens: `YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `M`, `DD`, `D`, `dddd`, `ddd`, `HH`, `H`,
 * `hh`, `h`, `mm`, `m`, `ss`, `s`, `A`, `a`; text in `[brackets]` stays as written.
 * @param date The date, in local time.
 * @param pattern The pattern.
 * @param locale The locale for month and weekday names.
 * @returns The formatted text.
 */
export function formatDate(date: Date, pattern: string, locale?: string): string {
	const hours = date.getHours();
	const twelve = hours % 12 || 12;

	return pattern.replace(TOKENS, (token, literal: string | undefined) => {
		if (literal !== undefined) return literal;

		switch (token) {
			case 'YYYY':
				return String(date.getFullYear());
			case 'YY':
				return pad(date.getFullYear() % 100);
			case 'MMMM':
				return name(date, locale, { month: 'long' });
			case 'MMM':
				return name(date, locale, { month: 'short' });
			case 'MM':
				return pad(date.getMonth() + 1);
			case 'M':
				return String(date.getMonth() + 1);
			case 'DD':
				return pad(date.getDate());
			case 'D':
				return String(date.getDate());
			case 'dddd':
				return name(date, locale, { weekday: 'long' });
			case 'ddd':
				return name(date, locale, { weekday: 'short' });
			case 'HH':
				return pad(hours);
			case 'H':
				return String(hours);
			case 'hh':
				return pad(twelve);
			case 'h':
				return String(twelve);
			case 'mm':
				return pad(date.getMinutes());
			case 'm':
				return String(date.getMinutes());
			case 'ss':
				return pad(date.getSeconds());
			case 's':
				return String(date.getSeconds());
			case 'A':
				return hours < 12 ? 'AM' : 'PM';
			default:
				return hours < 12 ? 'am' : 'pm';
		}
	});
}

/**
 * @description Tells whether two dates fall on the same local day.
 * @param a One date.
 * @param b The other.
 * @returns Whether they share a calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * @description Reads a message's timestamp, which Discord keeps as a `Date`, a moment or an ISO string.
 * @param value The message's `timestamp`.
 * @returns The date, or `undefined` when it cannot be read.
 */
export function toDate(value: unknown): Date | undefined {
	const time =
		value instanceof Date
			? value.getTime()
			: typeof value === 'string' || typeof value === 'number'
				? new Date(value).getTime()
				: typeof (value as { valueOf?: () => unknown } | null)?.valueOf === 'function'
					? Number((value as { valueOf: () => unknown }).valueOf())
					: Number.NaN;

	return Number.isFinite(time) ? new Date(time) : undefined;
}

export default { formatDate, isSameDay, toDate };
