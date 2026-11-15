const UPSIDE_DOWN: Record<string, string> = {
	a: 'ɐ',
	b: 'q',
	c: 'ɔ',
	d: 'p',
	e: 'ǝ',
	f: 'ɟ',
	g: 'ƃ',
	h: 'ɥ',
	i: 'ᴉ',
	j: 'ɾ',
	k: 'ʞ',
	l: 'l',
	m: 'ɯ',
	n: 'u',
	o: 'o',
	p: 'd',
	q: 'b',
	r: 'ɹ',
	s: 's',
	t: 'ʇ',
	u: 'n',
	v: 'ʌ',
	w: 'ʍ',
	x: 'x',
	y: 'ʎ',
	z: 'z',
	A: '∀',
	B: 'ꓭ',
	C: 'Ɔ',
	D: 'ꓷ',
	E: 'Ǝ',
	F: 'Ⅎ',
	G: 'ꓨ',
	H: 'H',
	I: 'I',
	J: 'ſ',
	K: 'ꓘ',
	L: '˥',
	M: 'W',
	N: 'N',
	O: 'O',
	P: 'Ԁ',
	Q: 'Ό',
	R: 'ꓤ',
	S: 'S',
	T: '⊥',
	U: '∩',
	V: 'Λ',
	W: 'M',
	X: 'X',
	Y: '⅄',
	Z: 'Z',
	'0': '0',
	'1': 'Ɩ',
	'2': 'ᄅ',
	'3': 'Ɛ',
	'4': 'ㄣ',
	'5': 'ϛ',
	'6': '9',
	'7': 'ㄥ',
	'8': '8',
	'9': '6',
	'.': '˙',
	',': "'",
	"'": ',',
	'"': '„',
	'?': '¿',
	'!': '¡',
	'(': ')',
	')': '(',
	'[': ']',
	']': '[',
	'{': '}',
	'}': '{',
	'<': '>',
	'>': '<',
	_: '‾',
	'&': '⅋',
	';': '؛',
};

const SMALL_CAPS: Record<string, string> = {
	a: 'ᴀ',
	b: 'ʙ',
	c: 'ᴄ',
	d: 'ᴅ',
	e: 'ᴇ',
	f: 'ꜰ',
	g: 'ɢ',
	h: 'ʜ',
	i: 'ɪ',
	j: 'ᴊ',
	k: 'ᴋ',
	l: 'ʟ',
	m: 'ᴍ',
	n: 'ɴ',
	o: 'ᴏ',
	p: 'ᴘ',
	q: 'ǫ',
	r: 'ʀ',
	s: 's',
	t: 'ᴛ',
	u: 'ᴜ',
	v: 'ᴠ',
	w: 'ᴡ',
	x: 'x',
	y: 'ʏ',
	z: 'ᴢ',
};

const ZALGO_MARKS = [
	...Array.from({ length: 0x036f - 0x0300 + 1 }, (_, index) =>
		String.fromCodePoint(0x0300 + index),
	),
];

const DISCORD_LIMIT = 2000;

/**
 * @description Alternates letter case, sPoNgEbOb style, starting lower and skipping anything that isn't a letter.
 * @param text The text to restyle.
 * @returns The mocking text.
 */
export function mock(text: string): string {
	let upper = false;

	return Array.from(text)
		.map((character) => {
			if (character.toLowerCase() === character.toUpperCase()) return character;

			upper = !upper;

			return upper ? character.toLowerCase() : character.toUpperCase();
		})
		.join('');
}

/**
 * @description Turns text upside down: each character is swapped for one that looks rotated, and the order is reversed.
 * @param text The text to restyle.
 * @returns The upside-down text.
 */
export function upsideDown(text: string): string {
	return Array.from(text)
		.reverse()
		.map((character) => UPSIDE_DOWN[character] ?? character)
		.join('');
}

/**
 * @description Writes lowercase letters as small capitals, leaving everything else as written.
 * @param text The text to restyle.
 * @returns The small-caps text.
 */
export function smallCaps(text: string): string {
	return Array.from(text.toLowerCase())
		.map((character) => SMALL_CAPS[character] ?? character)
		.join('');
}

/**
 * @description Stacks combining marks on each non-space character, as many as fit in Discord's message limit.
 * @param text The text to restyle.
 * @param intensity Marks per character, at most.
 * @param random A source of numbers from 0 up to 1, so tests can pin the output.
 * @returns The zalgo text, at most 2000 characters long.
 */
export function zalgo(text: string, intensity = 6, random: () => number = Math.random): string {
	const characters = Array.from(text);
	const letters = characters.filter((character) => character.trim()).length || 1;
	const budget = Math.max(0, DISCORD_LIMIT - text.length);
	const perCharacter = Math.min(intensity, Math.floor(budget / letters));

	return characters
		.map((character) => {
			if (!character.trim()) return character;

			const count = Math.ceil(random() * perCharacter);
			let marks = '';

			for (let index = 0; index < count; index++) {
				marks += ZALGO_MARKS[Math.floor(random() * ZALGO_MARKS.length)];
			}

			return character + marks;
		})
		.join('');
}

export default { mock, upsideDown, smallCaps, zalgo };
