import type { ThemedToken } from 'shiki';

import { Palette } from '~/constants';

export type ColorSpan = {
	color: string;
	/** Shiki's bit flags: 1 italic, 2 bold, 4 underline. Omitted when 0. */
	fontStyle?: number;
	length: number;
	location: number;
};

export type CodeMarkup = {
	spans: ColorSpan[];
	text: string;
};

/**
 * @description Lays highlighted tokens out as line-numbered text plus the color runs to paint over it.
 * @param tokens The tokens of each line.
 * @param light Whether the card uses the light palette, for line numbers and uncolored tokens.
 * @returns The text and its spans, with adjacent runs of the same style merged.
 */
export function buildCodeMarkup(tokens: ThemedToken[][], light: boolean): CodeMarkup {
	const palette = Palette[light ? 'light' : 'dark'];
	const spans: ColorSpan[] = [];
	let text = '';

	function append(content: string, color: string, fontStyle: number = 0) {
		if (!content) return;

		const previous = spans.at(-1);

		if (
			previous?.color === color &&
			(previous.fontStyle ?? 0) === fontStyle &&
			previous.location + previous.length === text.length
		) {
			previous.length += content.length;
		} else {
			spans.push({
				color,
				length: content.length,
				location: text.length,
				...(fontStyle ? { fontStyle } : {}),
			});
		}

		text += content;
	}

	for (const [index, line] of tokens.entries()) {
		if (index > 0) text += '\n';

		append(`${String(index + 1).padStart(2, ' ')} `, palette.lineNumber);

		for (const token of line) {
			append(token.content, token.color ?? palette.foreground, token.fontStyle ?? 0);
		}
	}

	return { spans, text };
}

export default { buildCodeMarkup };
