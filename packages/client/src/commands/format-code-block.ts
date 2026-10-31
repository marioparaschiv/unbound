/** Discord's message length limit. */
export const MESSAGE_LIMIT = 2000;

const ELLIPSIS = '…';

/**
 * @description Wraps text in a fenced code block that fits in one Discord message, cutting the text if needed.
 * @param text The text to show, such as an inspected eval result.
 * @param language The code block's language tag.
 * @param limit The longest message allowed, fences included.
 * @returns The code block, at most `limit` characters long.
 */
export function formatCodeBlock(
	text: string,
	language: string = 'js',
	limit: number = MESSAGE_LIMIT,
): string {
	const open = `\`\`\`${language}\n`;
	const close = '\n```';
	// A zero-width space between backticks keeps a fence inside the text from closing the block early.
	const body = text.replaceAll('```', '`\u200B`\u200B`');
	const room = limit - open.length - close.length;
	const fitted = body.length > room ? body.slice(0, room - ELLIPSIS.length) + ELLIPSIS : body;

	return open + fitted + close;
}

export default formatCodeBlock;
