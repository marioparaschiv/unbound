export type CalendarEvent = {
	summary: string;
	start?: Date;
	end?: Date;
	allDay: boolean;
	location?: string;
	description?: string;
};

type Property = { name: string; params: Record<string, string>; value: string };

const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

function unfold(text: string): string[] {
	return text
		.replace(/\r\n|\r/g, '\n')
		.replace(/\n[ \t]/g, '')
		.split('\n');
}

function unescape(value: string): string {
	return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function readProperty(line: string): Property | undefined {
	const colon = line.indexOf(':');

	if (colon <= 0) return undefined;

	const [name = '', ...params] = line.slice(0, colon).split(';');

	return {
		name: name.toUpperCase(),
		params: Object.fromEntries(
			params.map((param) => {
				const [key = '', value = ''] = param.split('=');

				return [key.toUpperCase(), value];
			}),
		),
		value: line.slice(colon + 1),
	};
}

function readDate({ value, params }: Property): { date?: Date; allDay: boolean } {
	const day = DATE.exec(value);

	if (day || params.VALUE === 'DATE') {
		const [, year, month, date] = day ?? [];

		return { date: new Date(Number(year), Number(month) - 1, Number(date)), allDay: true };
	}

	const time = DATE_TIME.exec(value);

	if (!time) return { allDay: false };

	const [, year, month, date, hour, minute, second] = time.map(Number);
	const parts = [year, month - 1, date, hour, minute, second] as const;

	return { date: time[7] ? new Date(Date.UTC(...parts)) : new Date(...parts), allDay: false };
}

/**
 * @description Reads the events of an iCalendar file: unfolds its lines and reads each VEVENT's summary, start, end,
 * location and description. Times in UTC become instants; times with a TZID or none read as the device's local time.
 * @param text The file's text.
 * @returns The events, in file order.
 */
export function parseCalendar(text: string): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	let current: CalendarEvent | undefined;

	for (const line of unfold(text)) {
		const property = readProperty(line.trim());

		if (!property) continue;

		if (property.name === 'BEGIN' && property.value.toUpperCase() === 'VEVENT') {
			current = { summary: '', allDay: false };
		} else if (
			property.name === 'END' &&
			property.value.toUpperCase() === 'VEVENT' &&
			current
		) {
			events.push(current);
			current = undefined;
		} else if (current && property.name === 'SUMMARY') {
			current.summary = unescape(property.value);
		} else if (current && property.name === 'LOCATION') {
			current.location = unescape(property.value);
		} else if (current && property.name === 'DESCRIPTION') {
			current.description = unescape(property.value);
		} else if (current && (property.name === 'DTSTART' || property.name === 'DTEND')) {
			const { date, allDay } = readDate(property);

			if (property.name === 'DTSTART') {
				current.start = date;
				current.allDay = allDay;
			} else {
				current.end = date;
			}
		}
	}

	return events;
}
