/** Discord's embed text limits, in UTF-16 code units. */
export const EMBED_LIMITS = {
	title: 256,
	description: 4096,
	footer: 2048,
	authorName: 256,
	total: 6000,
} as const;

/**
 * @description Shortens text to a Discord length limit, marking the cut with an ellipsis.
 * @param text The text to fit.
 * @param max The limit in UTF-16 code units, as Discord counts.
 * @returns The text unchanged when it fits, otherwise its start ending in `…`, never splitting a surrogate pair.
 */
export function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}

	if (max <= 0) {
		return '';
	}

	let end = max - 1;
	const last = text.charCodeAt(end - 1);

	// Never keep half of a surrogate pair; Discord rejects or mangles a lone surrogate.
	if (last >= 0xd8_00 && last <= 0xdb_ff) {
		end--;
	}

	return `${text.slice(0, end)}…`;
}

/**
 * @description Quotes text as a Discord block quote, line by line.
 * @param text The text; surrounding blank space is dropped.
 * @returns The quoted text.
 */
export function quote(text: string): string {
	return text
		.trim()
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');
}

export default { EMBED_LIMITS, truncate, quote };
