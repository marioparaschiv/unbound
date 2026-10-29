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

const PLACEHOLDER = '\ufffc';
const TAG_MARKS = ['\u200b', '\u200c', '\u200d', '\u2060'];
const TAG_LENGTH = 16;

function textTag(text: string): string {
	let hash = 0x811c9dc5;

	for (let index = 0; index < text.length; index++) {
		hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	}

	let tag = '';

	for (let index = 0; index < TAG_LENGTH; index++) {
		tag += TAG_MARKS[(hash >>> (index * 2)) & 3];
	}

	return tag;
}

/**
 * @description Builds the text that replaces each slot. The last placeholder carries an invisible tag of the original text, so messages that differ only inside their code blocks still render to different text.
 * @param original The message text.
 * @param slots The slots, in text order.
 * @returns Each slot's replacement text.
 */
export function placeholderTexts(original: string, slots: SpanRange[]): string[] {
	return slots.map((_, index) =>
		index === slots.length - 1 ? PLACEHOLDER + textTag(original) : PLACEHOLDER,
	);
}

/**
 * @description Replaces each slot of a message text with its placeholder.
 * @param original The message text.
 * @param slots The slots, in text order.
 * @returns The text Discord shows once the cards take the slots' place.
 */
export function renderedText(original: string, slots: SpanRange[]): string {
	const texts = placeholderTexts(original, slots);
	let text = original;

	for (let index = slots.length - 1; index >= 0; index--) {
		const slot = slots[index]!;

		text = text.slice(0, slot.start) + texts[index] + text.slice(slot.end);
	}

	return text;
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
