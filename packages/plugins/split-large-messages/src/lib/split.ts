const FENCE = /```(\S*)/g;

function cutAt(text: string, limit: number): number {
	const window = text.slice(0, limit);

	for (const separator of ['\n\n', '\n', '. ', ' ']) {
		const at = window.lastIndexOf(separator);

		if (at > limit / 2) return at + separator.length;
	}

	return limit;
}

function openFence(text: string): string | undefined {
	let language: string | undefined;

	for (const match of text.matchAll(FENCE)) {
		language = language === undefined ? (match[1] ?? '') : undefined;
	}

	return language;
}

/**
 * @description Splits a message into parts no longer than the limit, breaking at blank lines, then lines, sentences and words,
 * and closing a code block at the end of a part and reopening it, with its language, at the start of the next.
 * @param text The message.
 * @param limit The longest part.
 * @returns The parts, in order; the message itself when it fits.
 */
export function splitMessage(text: string, limit: number): string[] {
	const parts: string[] = [];
	let rest = text;
	let reopen = '';

	while (rest.length > 0) {
		const room = limit - reopen.length - 4;

		if (reopen.length + rest.length <= limit) {
			parts.push(reopen + rest);
			break;
		}

		const cut = cutAt(rest, room);
		let part = reopen + rest.slice(0, cut).trimEnd();
		const language = openFence(part);

		if (language !== undefined) part += '\n```';

		parts.push(part);
		rest = rest.slice(cut).replace(/^\s*\n/, '');
		reopen = language !== undefined ? `\`\`\`${language}\n` : '';
	}

	return parts;
}

export default { splitMessage };
