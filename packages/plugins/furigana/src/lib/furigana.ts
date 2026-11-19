const KANJI = new RegExp('[\\u3400-\\u4dbf\\u4e00-\\u9fff\\u3005]');
const KANA = new RegExp('[\\u3040-\\u30ff]');
const KATAKANA_TO_HIRAGANA = 0x60;

/** A word the tokenizer found: where it sits in the text, and its reading in hiragana. */
export type ReadToken = { start: number; length: number; reading: string };

/**
 * @description Tells whether a message reads as Japanese with kanji in it: kanji, and kana beside them.
 * @param text The message text.
 * @returns Whether to show its furigana.
 */
export function needsFurigana(text: string): boolean {
	return KANJI.test(text) && KANA.test(text);
}

function asHiragana(text: string): string {
	return [...text]
		.map((character) => {
			const code = character.charCodeAt(0);

			return code >= 0x30a1 && code <= 0x30f6
				? String.fromCharCode(code - KATAKANA_TO_HIRAGANA)
				: character;
		})
		.join('');
}

function annotate(surface: string, reading: string): string {
	let head = 0;
	let tail = 0;

	while (
		head < surface.length &&
		!KANJI.test(surface[head]!) &&
		asHiragana(surface[head]!) === reading[head]
	) {
		head++;
	}

	while (
		tail < surface.length - head &&
		!KANJI.test(surface[surface.length - 1 - tail]!) &&
		asHiragana(surface[surface.length - 1 - tail]!) === reading[reading.length - 1 - tail]
	) {
		tail++;
	}

	const core = surface.slice(head, surface.length - tail);
	const coreReading = reading.slice(head, reading.length - tail);

	return `${surface.slice(0, head)}${core}(${coreReading})${surface.slice(surface.length - tail)}`;
}

/**
 * @description Writes a message with each word that has kanji followed by its reading, keeping kana the word shares with
 * its reading outside the brackets: 東京で日本語を勉強しています becomes 東京(とうきょう)で日本(にっぽん)語(ご)を勉強(べんきょう)しています.
 * @param text The message text.
 * @param tokens The words the tokenizer found, in order, with their readings.
 * @returns The line to show under the message.
 */
export function furiganaLine(text: string, tokens: ReadToken[]): string {
	let line = '';
	let at = 0;

	for (const { start, length, reading } of tokens) {
		if (start < at) continue;

		const surface = text.slice(start, start + length);

		line += text.slice(at, start);
		line +=
			KANJI.test(surface) && reading && reading !== surface
				? annotate(surface, reading)
				: surface;
		at = start + length;
	}

	return line + text.slice(at);
}

export default { needsFurigana, furiganaLine };
