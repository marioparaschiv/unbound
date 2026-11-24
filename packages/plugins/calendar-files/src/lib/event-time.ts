const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const TIME: Intl.DateTimeFormatOptions = { timeStyle: 'short' };

function sameDay(a: Date, b: Date): boolean {
	return a.toDateString() === b.toDateString();
}

/**
 * @description Writes when a timed event runs, giving the end's date only when it ends on another day.
 * @param start When it starts.
 * @param end When it ends, if it says.
 * @param locale The language to write it in, the device's own by default.
 * @returns The span, such as `Dec 24, 2026, 7:00 PM – 9:00 PM`.
 */
export function eventTime(start: Date, end?: Date, locale?: string): string {
	const from = start.toLocaleString(locale, DATE_TIME);

	if (!end) return from;

	return `${from} – ${end.toLocaleString(locale, sameDay(start, end) ? TIME : DATE_TIME)}`;
}
