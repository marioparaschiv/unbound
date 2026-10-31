/** One day in milliseconds; a calendar day is longer or shorter across a daylight-saving change. */
export const DAY_MS = 86_400_000;

/**
 * @description Reads a `YYYY-MM-DD` calendar day as local midnight of that day.
 * @param day The calendar day.
 * @returns A `Date` whose local year, month and day are the given ones.
 */
export function parseCalendarDate(day: string): Date {
	const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
	const parsed = new Date(year, month - 1, date);

	// The constructor maps years 0-99 onto 1900-1999.
	parsed.setFullYear(year);

	return parsed;
}

/**
 * @description Writes the local calendar day of a `Date` as `YYYY-MM-DD`.
 * @param date The date.
 * @returns The calendar day.
 */
export function formatCalendarDate(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

export default { DAY_MS, parseCalendarDate, formatCalendarDate };
