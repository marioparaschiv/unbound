import { australianSpellings, mappings } from '~/translation/lexicon';

const protectedText =
	/(```[\s\S]*?```|`[^`]*`|<@!?\d+>|<@&\d+>|<#\d+>|<a?:[\w~]+:\d+>|https?:\/\/[^\s<]+)/g;
const protectedPart =
	/^(```[\s\S]*?```|`[^`]*`|<@!?\d+>|<@&\d+>|<#\d+>|<a?:[\w~]+:\d+>|https?:\/\/[^\s<]+)$/;
const words = new Map(mappings.filter(([source]) => !source.includes(' ')));
const phrases = mappings
	.filter(([source]) => source.includes(' '))
	.sort(([left], [right]) => right.length - left.length);
const wordPattern = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

function escapeRegExp(value: string): string {
	return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function matchCase(source: string, replacement: string): string {
	if (source === source.toUpperCase()) return replacement.toUpperCase();
	if (source === source.toLowerCase()) return replacement.toLowerCase();
	if (`${source[0]}${source.slice(1).toLowerCase()}` === source) {
		return `${replacement[0].toUpperCase()}${replacement.slice(1).toLowerCase()}`;
	}

	const sourceLetters = source.replace(/[^A-Za-z]/g, '');
	let letterIndex = 0;
	return replacement.replace(/[A-Za-z]/g, (letter) => {
		const sourceLetter = sourceLetters[Math.min(letterIndex, sourceLetters.length - 1)];
		letterIndex += 1;
		return sourceLetter === sourceLetter.toUpperCase()
			? letter.toUpperCase()
			: letter.toLowerCase();
	});
}

function replacePhrase(
	text: string,
	source: string,
	replacement: string,
	preserved: string[],
): string {
	const expression = new RegExp(`\\b${escapeRegExp(source).replace(/ /g, '\\s+')}\\b`, 'gi');
	return text.replace(expression, (match) => {
		preserved.push(matchCase(match, replacement));
		return `\uE000${preserved.length - 1}\uE001`;
	});
}

function pluralize(word: string): string {
	if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
	if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
	return `${word}s`;
}

function singularWords(word: string): string[] {
	if (word.endsWith('ies')) return [`${word.slice(0, -3)}ie`, `${word.slice(0, -3)}y`];
	if (word.endsWith('es')) return [word.slice(0, -2), word.slice(0, -1)];
	if (word.endsWith('s')) return [word.slice(0, -1)];
	return [];
}

function replaceWord(word: string): string {
	const normalized = word.toLowerCase();
	const replacement = words.get(normalized) ?? australianSpellings[normalized];
	if (replacement) return matchCase(word, replacement);

	const singularReplacement = singularWords(normalized)
		.map((singular) => words.get(singular))
		.find((candidate): candidate is string => Boolean(candidate));
	return singularReplacement ? matchCase(word, pluralize(singularReplacement)) : word;
}

function replaceWords(text: string): string {
	return text.replace(wordPattern, replaceWord);
}

function translateText(text: string): string {
	const preserved: string[] = [];
	let translated = text;
	for (const [source, replacement] of phrases) {
		translated = replacePhrase(translated, source, replacement, preserved);
	}
	return replaceWords(translated).replace(
		/\uE000(\d+)\uE001/g,
		(_match, index: string) => preserved[Number(index)],
	);
}

export function translate(content: string): string {
	return content
		.split(protectedText)
		.map((part) => (part && !protectedPart.test(part) ? translateText(part) : part))
		.join('');
}
