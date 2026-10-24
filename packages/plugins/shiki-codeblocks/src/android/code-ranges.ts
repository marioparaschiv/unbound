import type { SpanRange } from '@unbound-plugins/shared/native/android/spans';

import type { CodeBlock } from '~/fences';

export type CodeSlot = SpanRange & {
	blockEnd: number;
	code: string;
};

const TRAILING_PADDING = /[\s ​]+$/;

/**
 * @description Turns the block background spans Discord draws code blocks with into the text each card replaces.
 * @param text The message text.
 * @param blocks The ranges of the text's block background spans.
 * @returns Each block's code, the range a card placeholder replaces (everything but the newline that ends the block), and where the block's spans end.
 */
export function codeSlots(text: string, blocks: SpanRange[]): CodeSlot[] {
	return blocks
		.filter(({ start, end }) => start >= 0 && end > start && end <= text.length)
		.slice()
		.sort((left, right) => left.start - right.start)
		.filter((block, index, sorted) => index === 0 || block.start >= sorted[index - 1]!.end)
		.map(({ start, end }) => ({
			start,
			end: text[end - 1] === '\n' && end - 1 > start ? end - 1 : end,
			blockEnd: end,
			code: text.slice(start, end).replace(TRAILING_PADDING, ''),
		}))
		.filter(({ code }) => code.length > 0);
}

/**
 * @description Finds where each placeholder lands once every slot is replaced by one character.
 * @param slots The slots, in text order.
 * @returns The placeholder index of each slot.
 */
export function placeholderOffsets(slots: SpanRange[]): number[] {
	let removed = 0;

	return slots.map(({ start, end }) => {
		const offset = start - removed;

		removed += end - start - 1;

		return offset;
	});
}

/**
 * @description Finds the fenced block a rendered code block came from, to learn its language.
 * @param code The rendered code.
 * @param blocks The fenced blocks of the messages that may contain it.
 * @returns The matching block, or `undefined` when none matches.
 */
export function sourceBlock(code: string, blocks: CodeBlock[]): CodeBlock | undefined {
	return (
		blocks.find((block) => block.code === code) ??
		blocks.find((block) => block.code.trim() === code.trim())
	);
}

export default { codeSlots, placeholderOffsets, sourceBlock };
