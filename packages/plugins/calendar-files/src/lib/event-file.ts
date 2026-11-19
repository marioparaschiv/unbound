export type NewEvent = {
	title: string;
	start: Date;
	minutes: number;
	location?: string;
	now?: Date;
};

function stamp(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

function escape(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/([,;])/g, '\\$1')
		.replace(/\n/g, '\\n');
}

/**
 * @description Writes a single-event iCalendar file in UTC, which calendar apps import as is.
 * @param event The title, start, length in minutes and optional location.
 * @returns The file's text, with CRLF line ends.
 */
export function buildCalendar({
	title,
	start,
	minutes,
	location,
	now = new Date(),
}: NewEvent): string {
	const end = new Date(start.getTime() + minutes * 60_000);
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Unbound//Calendar Files//EN',
		'BEGIN:VEVENT',
		`UID:${stamp(now)}-${Math.round(start.getTime() / 1000)}@unbound.rip`,
		`DTSTAMP:${stamp(now)}`,
		`DTSTART:${stamp(start)}`,
		`DTEND:${stamp(end)}`,
		`SUMMARY:${escape(title)}`,
		...(location ? [`LOCATION:${escape(location)}`] : []),
		'END:VEVENT',
		'END:VCALENDAR',
	];

	return `${lines.join('\r\n')}\r\n`;
}

/**
 * @description Reads a start time typed into `/event`: an ISO date and time, or a time today such as `18:30`.
 * @param text What was typed.
 * @param now The current time.
 * @returns The start, or `undefined` when the text is no time.
 */
export function readStart(text: string, now = new Date()): Date | undefined {
	const time = /^(\d{1,2}):(\d{2})$/.exec(text.trim());

	if (time) {
		const start = new Date(now);

		start.setHours(Number(time[1]), Number(time[2]), 0, 0);

		return start;
	}

	const parsed = new Date(text.trim().replace(' ', 'T'));

	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
