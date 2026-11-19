const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
const VOWEL_COUNT = 21;
const FINAL_COUNT = 28;

const IEUNG = 11;
const HIEUT = 18;
const RIEUL = 5;
const NIEUN = 2;
const MIEUM = 6;
const GIYEOK = 0;
const DIGEUT = 3;
const JIEUT = 12;
const TIKEUT = 16;
const I_VOWEL = 20;

const INITIALS = [
	'g',
	'kk',
	'n',
	'd',
	'tt',
	'r',
	'm',
	'b',
	'pp',
	's',
	'ss',
	'',
	'j',
	'jj',
	'ch',
	'k',
	't',
	'p',
	'h',
];
const VOWELS = [
	'a',
	'ae',
	'ya',
	'yae',
	'eo',
	'e',
	'yeo',
	'ye',
	'o',
	'wa',
	'wae',
	'oe',
	'yo',
	'u',
	'wo',
	'we',
	'wi',
	'yu',
	'eu',
	'ui',
	'i',
];

const FINAL_PARTS: number[][] = [
	[],
	[0],
	[1],
	[0, 9],
	[2],
	[2, 12],
	[2, 18],
	[3],
	[5],
	[5, 0],
	[5, 6],
	[5, 7],
	[5, 9],
	[5, 16],
	[5, 17],
	[5, 18],
	[6],
	[7],
	[7, 9],
	[9],
	[10],
	[11],
	[12],
	[14],
	[15],
	[16],
	[17],
	[18],
];

type Coda = 'k' | 'n' | 't' | 'l' | 'm' | 'p' | 'ng';

const CODAS: (Coda | '')[] = [
	'',
	'k',
	'k',
	'k',
	'n',
	'n',
	'n',
	't',
	'l',
	'k',
	'm',
	'l',
	'l',
	'l',
	'p',
	'l',
	'm',
	'p',
	'p',
	't',
	't',
	'ng',
	't',
	't',
	'k',
	't',
	'p',
	't',
];

const STAYING: Record<number, string> = { 0: 'k', 2: 'n', 5: 'l', 7: 'p' };
const NASAL: Partial<Record<Coda, string>> = { k: 'ng', t: 'n', p: 'm' };
const ASPIRATED: Partial<Record<Coda, string>> = { k: 'k', t: 't', p: 'p' };
const ASPIRATED_AFTER_HIEUT: Record<number, string> = {
	[GIYEOK]: 'k',
	[DIGEUT]: 't',
	[JIEUT]: 'ch',
};

type Syllable = { initial: number; vowel: number; final: number };

function syllableOf(character: string): Syllable | undefined {
	const code = character.charCodeAt(0) - SYLLABLE_START;

	if (code < 0 || code > SYLLABLE_END - SYLLABLE_START) return undefined;

	return {
		initial: Math.floor(code / (VOWEL_COUNT * FINAL_COUNT)),
		vowel: Math.floor((code % (VOWEL_COUNT * FINAL_COUNT)) / FINAL_COUNT),
		final: code % FINAL_COUNT,
	};
}

function movedInitial(consonant: number, nextVowel: number): string {
	if (nextVowel === I_VOWEL && consonant === DIGEUT) return 'j';

	if (nextVowel === I_VOWEL && consonant === TIKEUT) return 'ch';

	return INITIALS[consonant]!;
}

function beforeVowel(final: number, nextVowel: number): [coda: string, initial: string] {
	const parts = FINAL_PARTS[final]!;
	const last = parts.at(-1)!;

	if (final === 21) return ['ng', ''];

	if (last === HIEUT) {
		return parts.length === 1 ? ['', ''] : ['', INITIALS[parts[0]!]!];
	}

	if (parts.length === 2) return [STAYING[parts[0]!] ?? '', movedInitial(last, nextVowel)];

	return ['', movedInitial(last, nextVowel)];
}

function beforeConsonant(final: number, initial: number): [coda: string, initial: string] {
	const coda = CODAS[final] as Coda;
	const parts = FINAL_PARTS[final]!;
	const plain = INITIALS[initial]!;

	if (parts.at(-1) === HIEUT && ASPIRATED_AFTER_HIEUT[initial]) {
		return [parts.length === 2 ? CODAS[final]! : '', ASPIRATED_AFTER_HIEUT[initial]!];
	}

	if (initial === HIEUT && ASPIRATED[coda]) {
		return ['', final === 22 ? 'ch' : ASPIRATED[coda]!];
	}

	if (initial === RIEUL) {
		if (coda === 'n' || coda === 'l') return ['l', 'l'];

		if (coda === 'm' || coda === 'ng') return [coda, 'n'];

		return [NASAL[coda] ?? coda, 'n'];
	}

	if (initial === NIEUN && coda === 'l') return ['l', 'l'];

	if ((initial === NIEUN || initial === MIEUM) && NASAL[coda]) return [NASAL[coda]!, plain];

	return [coda, plain];
}

function romanizeWord(syllables: Syllable[]): string {
	let text = '';
	let initial = INITIALS[syllables[0]!.initial]!;

	for (const [index, syllable] of syllables.entries()) {
		const next = syllables[index + 1];
		let coda: string = CODAS[syllable.final]!;
		let nextInitial = next ? INITIALS[next.initial]! : '';

		if (next && syllable.final) {
			[coda, nextInitial] =
				next.initial === IEUNG
					? beforeVowel(syllable.final, next.vowel)
					: beforeConsonant(syllable.final, next.initial);
		}

		text += initial + VOWELS[syllable.vowel] + coda;
		initial = nextInitial;
	}

	return text;
}

/**
 * @description Writes Hangul in Latin letters by the Revised Romanization of Korean (2000), with its sound changes inside
 * each word: liaison, nasalisation, ㄹ assimilation, aspiration with ㅎ and palatalisation. Other characters stay.
 * @param text The text.
 * @returns The text with every run of Hangul syllables romanised.
 */
export function romanizeHangul(text: string): string {
	let output = '';
	let word: Syllable[] = [];

	for (const character of text) {
		const syllable = syllableOf(character);

		if (syllable) {
			word.push(syllable);
			continue;
		}

		if (word.length) output += romanizeWord(word);

		word = [];
		output += character;
	}

	return word.length ? output + romanizeWord(word) : output;
}

export default romanizeHangul;
