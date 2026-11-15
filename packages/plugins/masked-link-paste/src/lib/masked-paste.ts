const URL_PATTERN = /^https?:\/\/[^\s<>()[\]]+$/i;

export type InputState = { text: string; start: number; end: number };

export type MaskedEdit = { text: string; caret: number };

/**
 * @description Spots a link pasted over selected text and builds the masked link that replaces it.
 * @param previous The text and selection before the change.
 * @param next The text and selection after it.
 * @returns The masked text and caret, or `undefined` when the change was not a link pasted over text.
 */
export function maskedPaste(previous: InputState, next: InputState): MaskedEdit | undefined {
	const start = Math.min(previous.start, previous.end);
	const end = Math.max(previous.start, previous.end);
	const selected = previous.text.slice(start, end);

	if (!selected.trim() || URL_PATTERN.test(selected.trim())) return undefined;

	const before = previous.text.slice(0, start);
	const after = previous.text.slice(end);
	const { text } = next;

	if (text.length <= before.length + after.length) return undefined;
	if (!text.startsWith(before) || !text.endsWith(after)) return undefined;

	const pasted = text.slice(before.length, text.length - after.length).trim();

	if (!URL_PATTERN.test(pasted)) return undefined;

	const masked = `[${selected.replace(/[[\]]/g, '\\$&')}](${pasted})`;

	return { text: before + masked + after, caret: before.length + masked.length };
}
