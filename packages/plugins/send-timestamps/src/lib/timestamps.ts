const TIME = /^(\d{1,2}):(\d{2}) ?(AM|PM)?$/i;
const BACKTICKED_TIME = /`\d{1,2}:\d{2} ?(?:AM|PM)?`/gi;

export type TimestampStyle = 'R' | 't' | 'T' | 'd' | 'D' | 'f' | 'F';

function clockTime(text: string, now: Date): Date | undefined {
	const match = TIME.exec(text.trim());

	if (!match) return undefined;

	let hours = Number(match[1]);
	const minutes = Number(match[2]);
	const half = match[3]?.toUpperCase();

	if (minutes > 59 || hours > 24 || (half && (hours < 1 || hours > 12))) return undefined;

	if (half === 'PM' && hours !== 12) hours += 12;

	if (half === 'AM' && hours === 12) hours = 0;

	const date = new Date(now);

	date.setHours(hours, minutes, 0, 0);

	if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1);

	return date;
}

/**
 * @description Reads a time such as `17:30` or `5:30 PM`, the next time it comes round, or a date and time JavaScript
 * understands, such as `2026-12-24 18:00`.
 * @param text The time.
 * @param now The current time.
 * @returns The moment, or `undefined` when the text is not a time.
 */
export function parseMoment(text: string, now: Date = new Date()): Date | undefined {
	const clock = clockTime(text, now);

	if (clock) return clock;

	const parsed = new Date(text.trim().replace(' ', 'T'));

	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * @description Writes Discord's timestamp markdown for a moment.
 * @param moment The moment.
 * @param style How Discord draws it.
 * @returns The markdown, such as `<t:1795132800:t>`.
 */
export function timestamp(moment: Date, style: TimestampStyle): string {
	return `<t:${Math.round(moment.getTime() / 1000)}:${style}>`;
}

/**
 * @description Replaces each time wrapped in backticks with a short time timestamp, leaving other text alone.
 * @param content The message text.
 * @param now The current time.
 * @returns The text with the times replaced.
 */
export function replaceTimes(content: string, now: Date = new Date()): string {
	return content.replace(BACKTICKED_TIME, (match) => {
		const moment = clockTime(match.slice(1, -1), now);

		return moment ? timestamp(moment, 't') : match;
	});
}
