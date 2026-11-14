/** Local edits, by message id. */
export type Edits = Record<string, string>;

/**
 * @description Reads stored local edits, dropping anything that is not a message id with text.
 * @param value The stored value.
 * @returns The edits.
 */
// UNKNOWN: storage returns whatever an older version saved.
export function parseEdits(value: unknown): Edits {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] =>
				/^\d{17,20}$/.test(entry[0]) && typeof entry[1] === 'string',
		),
	);
}

/**
 * @description Sets or clears a message's local edit: text equal to the original, or empty, clears it.
 * @param edits The current edits.
 * @param messageId The message.
 * @param text The new text.
 * @param original What the message says on Discord.
 * @returns The new edits.
 */
export function withEdit(edits: Edits, messageId: string, text: string, original: string): Edits {
	const { [messageId]: _previous, ...rest } = edits;

	return text.trim() && text !== original ? { ...rest, [messageId]: text } : rest;
}

export default parseEdits;
