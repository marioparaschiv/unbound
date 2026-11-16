const NOISE = /```[\s\S]*?```|`[^`]*`|<[@#&!a:]*[\w:]*\d+>|https?:\/\/\S+|:[\w~]+:/g;
const WORD = /\p{L}[\p{L}\p{M}'’-]*\p{L}|\p{L}/gu;
const MAX_WORDS = 40;

/**
 * @description Lists the words worth looking up in a message, without code, links, mentions or emoji, each once.
 * @param content The message text.
 * @returns At most 40 words, lowercased unless written in capitals throughout, in the order they appear.
 */
export function wordsIn(content: string): string[] {
	const seen = new Set<string>();
	const words: string[] = [];

	for (const [match] of content.replace(NOISE, ' ').matchAll(WORD)) {
		const word = match.replace(/[’]/g, "'");
		const key = word.toLowerCase();

		if (word.length < 2 || seen.has(key)) continue;

		seen.add(key);
		words.push(word === word.toUpperCase() && word.length > 1 ? word : key);

		if (words.length === MAX_WORDS) break;
	}

	return words;
}

export default { wordsIn };
