import { hasHighlightLanguage } from '~/highlight-js';
import { resolveLanguage } from '~/languages';

export type CodeBlock = {
	code: string;
	language: string;
	/** The fence's code before normalization, when it differs; this is what Copy copies. */
	originalCode?: string;
	/** The fence's tag, kept when only Highlight.js knows it. */
	sourceLanguage?: string;
};

export type CodeBlockPlacement = {
	block: CodeBlock;
	start: number;
	end: number;
};

function normalizeCode(code: string): string {
	return code
		.replaceAll('\r\n', '\n')
		.replaceAll('\u200B', '')
		.replace(/^\n+/, '')
		.replace(/\n+$/, '');
}

/**
 * @description Finds the fenced code blocks in a message's Markdown.
 * @param content The raw message content.
 * @returns Each closed fence's code and resolved language, in order; an unknown language becomes `plain`.
 */
export function parseFencedCodeBlocks(content: string): CodeBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: CodeBlock[] = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const opening = /^[\t ]{0,3}(`{3,}|~{3,})(.*)$/.exec(lines[lineIndex]);

		if (!opening) {
			continue;
		}

		const fence = opening[1];
		const closingIndex = lines.findIndex((line, index) => {
			if (index <= lineIndex) return false;

			const closing = /^[\t ]{0,3}(`{3,}|~{3,})[\t ]*$/.exec(line);

			return Boolean(
				closing && closing[1][0] === fence[0] && closing[1].length >= fence.length,
			);
		});

		if (closingIndex < 0) break;

		const sourceLanguage = opening[2].trim().split(/[\t ]+/, 1)[0];
		const language = resolveLanguage(sourceLanguage) ?? 'plain';
		const originalCode = lines.slice(lineIndex + 1, closingIndex).join('\n');
		const code = normalizeCode(originalCode);

		blocks.push({
			code,
			language,
			...(code !== originalCode ? { originalCode } : {}),
			...(language === 'plain' && hasHighlightLanguage(sourceLanguage)
				? { sourceLanguage }
				: {}),
		});

		lineIndex = closingIndex;
	}

	return blocks;
}

function countOccurrences(text: string, search: string): number {
	let count = 0;

	for (let cursor = text.indexOf(search); cursor >= 0; cursor = text.indexOf(search, cursor)) {
		count++;
		cursor += search.length;
	}

	return count;
}

const TAB_WIDTH = 4;

/**
 * @description Expands tabs the way Discord renders them in a message, four spaces each.
 * @param code The code as written.
 * @returns The code as Discord shows it.
 */
export function expandTabs(code: string): string {
	return code.replaceAll('\t', ' '.repeat(TAB_WIDTH));
}

function renderedForm(code: string, rendered: string): string {
	if (rendered.includes(code) || !code.includes('\t')) return code;

	return expandTabs(code);
}

/**
 * @description Finds where each code block sits in the text Discord rendered for a message, allowing for Discord expanding tabs to spaces when it renders.
 * @param blocks The message's fenced blocks, in order.
 * @param rendered The label's plain text.
 * @returns Each block's range, widened over its surrounding newlines, or `[]` when any block is missing, ambiguous or split.
 */
export function locateCodeBlocks(blocks: CodeBlock[], rendered: string): CodeBlockPlacement[] {
	if (!blocks.length || blocks.some((block) => !block.code)) return [];

	const expected = new Map<string, number>();
	const shown = blocks.map((block) => renderedForm(block.code, rendered));

	for (const code of shown) expected.set(code, (expected.get(code) ?? 0) + 1);

	for (const [code, count] of expected) {
		if (countOccurrences(rendered, code) !== count) return [];
	}

	const placements: CodeBlockPlacement[] = [];
	let cursor = 0;

	for (const [index, block] of blocks.entries()) {
		const code = shown[index]!;
		const codeStart = rendered.indexOf(code, cursor);

		if (codeStart < 0) return [];

		const codeEnd = codeStart + code.length;

		if (codeStart > 0 && rendered[codeStart - 1] !== '\n') return [];

		if (codeEnd < rendered.length && rendered[codeEnd] !== '\n') return [];

		let start = codeStart;
		let end = codeEnd;

		while (start > cursor && rendered[start - 1] === '\n') start--;

		while (end < rendered.length && rendered[end] === '\n') end++;

		placements.push({ block, start, end });
		cursor = end;
	}

	return placements;
}

export default { expandTabs, parseFencedCodeBlocks, locateCodeBlocks };
