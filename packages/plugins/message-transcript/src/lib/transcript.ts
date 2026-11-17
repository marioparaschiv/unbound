export type TranscriptMessage = {
	id: string;
	author: string;
	timestamp: string | number | Date;
	content: string;
	attachments: string[];
};

export type TranscriptOptions = { dates: boolean };

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function stamp(when: Date, { dates }: TranscriptOptions): string {
	const time = `${pad(when.getHours())}:${pad(when.getMinutes())}`;

	if (!dates) return time;

	return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${time}`;
}

function body({ content, attachments }: TranscriptMessage): string {
	return [content.trim(), ...attachments].filter(Boolean).join('\n');
}

/**
 * @description Picks the messages between two ids, inclusive, in the order the channel shows them.
 * @param messages The channel's loaded messages, oldest first.
 * @param fromId One end of the selection.
 * @param toId The other end; it may come before `fromId`.
 * @returns The selected messages, oldest first, or none when an end is not loaded.
 */
export function selectRange<T extends { id: string }>(
	messages: T[],
	fromId: string,
	toId: string,
): T[] {
	const from = messages.findIndex(({ id }) => id === fromId);
	const to = messages.findIndex(({ id }) => id === toId);

	if (from < 0 || to < 0) return [];

	return messages.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/**
 * @description Writes messages as a plain-text transcript: one `[time] Author: text` block per message, a second
 * line indented under the first, and attachments by link.
 * @param messages The messages, oldest first.
 * @param options Whether to put the date before each time, for ranges that span days.
 * @returns The transcript.
 */
export function formatTranscript(
	messages: TranscriptMessage[],
	options: TranscriptOptions,
): string {
	return messages
		.map((message) => {
			const [first = '', ...rest] = body(message).split('\n');
			const head = `[${stamp(new Date(message.timestamp), options)}] ${message.author}: ${first}`;

			return [head, ...rest.map((line) => `    ${line}`)].join('\n');
		})
		.join('\n');
}

/**
 * @description Tells whether a range spans more than one calendar day, so the transcript shows dates.
 * @param messages The messages.
 * @returns Whether their days differ.
 */
export function spansDays(messages: TranscriptMessage[]): boolean {
	const days = new Set(messages.map(({ timestamp }) => new Date(timestamp).toDateString()));

	return days.size > 1;
}
