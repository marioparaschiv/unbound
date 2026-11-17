const REGIONAL_A = 0x1f1e6;
const KEYCAP = '️⃣';
const MAX_REACTIONS = 20;

const LOOKALIKES: Record<string, string[]> = {
	a: ['🅰️'],
	b: ['🅱️'],
	c: ['©️'],
	e: ['📧'],
	h: ['♓'],
	i: ['ℹ️'],
	m: ['Ⓜ️', '〽️'],
	o: ['🅾️', '⭕'],
	p: ['🅿️'],
	r: ['®️'],
	s: ['💲'],
	t: ['✝️'],
	x: ['❌', '✖️'],
	z: ['💤'],
	'!': ['❗', '❕'],
	'?': ['❓', '❔'],
};

/** Why a word can't be spelled, or the reactions that spell it. */
export type Spelling =
	| { ok: true; emoji: string[] }
	| { ok: false; reason: 'empty' }
	| { ok: false; reason: 'unsupported'; characters: string[] }
	| { ok: false; reason: 'repeats'; letters: string[] }
	| { ok: false; reason: 'too-many'; count: number };

function choices(character: string): string[] {
	if (/^[a-z]$/.test(character)) {
		return [
			String.fromCodePoint(REGIONAL_A + character.charCodeAt(0) - 97),
			...(LOOKALIKES[character] ?? []),
		];
	}

	if (/^[0-9]$/.test(character)) return [`${character}${KEYCAP}`];

	return LOOKALIKES[character] ?? [];
}

/**
 * @description Picks one reaction per letter, digit, `!` and `?` of a word, ignoring spaces. A message holds each emoji
 * once, so repeated letters take look-alikes, and emoji already on the message are skipped.
 * @param word The word.
 * @param taken Emoji already on the message.
 * @returns The reactions in order, or why the word can't be spelled.
 */
export function spell(word: string, taken: ReadonlySet<string> = new Set()): Spelling {
	const characters = [...word.toLowerCase()].filter((character) => character.trim() !== '');

	if (characters.length === 0) return { ok: false, reason: 'empty' };

	const unsupported = [
		...new Set(characters.filter((character) => choices(character).length === 0)),
	];

	if (unsupported.length) return { ok: false, reason: 'unsupported', characters: unsupported };
	if (characters.length + taken.size > MAX_REACTIONS) {
		return { ok: false, reason: 'too-many', count: characters.length + taken.size };
	}

	const used = new Set(taken);
	const emoji: string[] = [];
	const missing = new Set<string>();

	for (const character of characters) {
		const pick = choices(character).find((choice) => !used.has(choice));

		if (!pick) {
			missing.add(character);
			continue;
		}

		used.add(pick);
		emoji.push(pick);
	}

	return missing.size
		? { ok: false, reason: 'repeats', letters: [...missing] }
		: { ok: true, emoji };
}
