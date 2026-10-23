// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'UTC',
});

/**
 * @description Formats a day in UTC, e.g. `Oct 23, 2026`.
 * @param value The time, as a `Date` or an ISO string.
 * @returns The formatted day.
 */
export function formatDate(value: Date | string): string {
	return DATE_FORMAT.format(new Date(value));
}

/**
 * @description Formats a moment in UTC, e.g. `Oct 23, 2026, 12:00 PM UTC`.
 * @param value The time, as a `Date` or an ISO string.
 * @returns The formatted day and time.
 */
export function formatDateTime(value: Date | string): string {
	return `${DATE_TIME_FORMAT.format(new Date(value))} UTC`;
}

export default { formatDate, formatDateTime };
