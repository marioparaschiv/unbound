export type PasteFormat = 'plain' | 'code' | 'quote' | 'link' | 'file';

const MARKDOWN = /([\\*_~`|>#\-[\]()])/g;
const SINGLE_URL = /^<?(https?:\/\/[^\s<>]+)>?$/i;
const FILE_FROM_LENGTH = 1500;

/**
 * @description Escapes Discord's markdown so the text shows exactly as written.
 * @param text The clipboard text.
 * @returns The escaped text.
 */
export function asPlainText(text: string): string {
	return text.replace(MARKDOWN, '\\$1');
}

/**
 * @description Wraps text in a code block whose fence is longer than any backtick run inside it.
 * @param text The clipboard text.
 * @returns The code block.
 */
export function asCodeBlock(text: string): string {
	const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));
	const fence = '`'.repeat(longest + 1);

	return `${fence}\n${text.replace(/\n+$/, '')}\n${fence}`;
}

/**
 * @description Quotes every line of the text.
 * @param text The clipboard text.
 * @returns The quoted text.
 */
export function asQuote(text: string): string {
	return text
		.replace(/\n+$/, '')
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');
}

/**
 * @description Reads the clipboard as a single link, if it is one.
 * @param text The clipboard text.
 * @returns The link, or `undefined` when the text is anything else.
 */
export function singleLink(text: string): string | undefined {
	return SINGLE_URL.exec(text.trim())?.[1];
}

/**
 * @description Picks the paste formats that suit the clipboard: a link without a preview only for a single link, a
 * text file only for long or multi-line text.
 * @param text The clipboard text.
 * @returns The formats to offer, in order.
 */
export function formatsFor(text: string): PasteFormat[] {
	if (singleLink(text)) return ['link', 'plain', 'quote'];

	const formats: PasteFormat[] = ['plain', 'code', 'quote'];

	if (text.length >= FILE_FROM_LENGTH || text.includes('\n')) formats.push('file');

	return formats;
}

export default { asPlainText, asCodeBlock, asQuote, singleLink, formatsFor };
