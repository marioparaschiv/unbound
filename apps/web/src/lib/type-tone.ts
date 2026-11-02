/** The colour family of a token in a rendered type, so each kind of value reads the same everywhere. */
export type TypeTone =
	| 'string'
	| 'number'
	| 'boolean'
	| 'nullish'
	| 'object'
	| 'reference'
	| 'property'
	| 'punctuation';

/** One token of a type written as text, such as a guide field's `string | { uri: string }`. */
export type TypeToken = {
	text: string;
	tone: TypeTone;
};

/** The text colour of each tone, in light and dark themes. */
export const TYPE_TONE_CLASSES: Record<TypeTone, string> = {
	string: 'text-emerald-700 dark:text-emerald-400',
	number: 'text-amber-700 dark:text-amber-400',
	boolean: 'text-violet-700 dark:text-violet-400',
	nullish: 'text-muted-foreground',
	object: 'text-pink-700 dark:text-pink-400',
	reference: 'text-sky-700 dark:text-sky-300',
	property: 'text-foreground',
	punctuation: 'text-muted-foreground',
};

const WORD_TONES: Record<string, TypeTone> = {
	string: 'string',
	number: 'number',
	bigint: 'number',
	boolean: 'boolean',
	true: 'boolean',
	false: 'boolean',
	null: 'nullish',
	undefined: 'nullish',
	void: 'nullish',
	never: 'nullish',
	object: 'object',
	any: 'object',
	unknown: 'object',
	symbol: 'object',
	function: 'object',
};

const STRING_LITERAL = /^['"`]/;
const NUMBER_LITERAL = /^-?\d/;
const WORD = /^[A-Za-z_$]/;

// Quoted strings, numbers, words, whitespace, then any single other character.
const TOKEN = /'[^']*'|"[^"]*"|`[^`]*`|-?\d[\d_.]*n?|[A-Za-z_$][\w$.]*|\s+|./g;

/**
 * @description Picks the tone of one token: a keyword such as `boolean` or a literal such as `'raw'`
 * by the kind of value it is, another word as a reference, anything else as punctuation.
 * @param text The token.
 * @returns The tone.
 */
export function getTypeTone(text: string): TypeTone {
	if (STRING_LITERAL.test(text)) {
		return 'string';
	}

	if (NUMBER_LITERAL.test(text)) {
		return 'number';
	}

	if (!WORD.test(text)) {
		return 'punctuation';
	}

	return WORD_TONES[text] ?? 'reference';
}

/**
 * @description Splits a type written as text into toned tokens. A word before `:` or `?:` is an object key, not a type.
 * @param type The type, such as `'color' | 'raw'`.
 * @returns The tokens in order; joined, they spell `type` again.
 */
export function tokenizeType(type: string): TypeToken[] {
	const texts = type.match(TOKEN) ?? [];

	return texts.map((text, index) => {
		const next = texts.slice(index + 1).find((after) => after.trim());
		const isKey = WORD.test(text) && (next === ':' || next === '?');

		return { text, tone: isKey ? 'property' : getTypeTone(text) };
	});
}

export default { TYPE_TONE_CLASSES, getTypeTone, tokenizeType };
