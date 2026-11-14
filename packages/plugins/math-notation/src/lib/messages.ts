import { convert } from '~/lib/tex';

const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^>\n]+>)/g;
const MATH =
	/\$\$([^$]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?![\s$])([^$\n]+?)(?<![\s\\])\$/g;
const MATHLIKE = /[\\^_=]/;

function convertPlain(text: string): string {
	return text.replace(
		MATH,
		(match, display?: string, bracket?: string, paren?: string, inline?: string) => {
			if (inline !== undefined && !MATHLIKE.test(inline)) return match;

			return convert(display ?? bracket ?? paren ?? inline ?? '').trim();
		},
	);
}

/**
 * @description Shows the math in a message as Unicode, leaving code, links and mentions alone. Single dollar signs only
 * count as math when their content has a backslash, `^`, `_` or `=`, so prices stay as written.
 * @param text The message text.
 * @returns The text with math converted, or the same string when it has none.
 */
export function convertMessage(text: string): string {
	if (!text.includes('$') && !text.includes('\\')) return text;

	const parts = text.split(PROTECTED);
	const result = parts
		.map((part, index) => (index % 2 === 1 ? part : convertPlain(part)))
		.join('');

	return result === text ? text : result;
}

export default convertMessage;
