const FLIPPED: Record<string, string> = {
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
	B: 'q',
	C: 'Ɔ',
	D: 'p',
	E: 'Ǝ',
	F: 'Ⅎ',
	G: 'פ',
	H: 'H',
	I: 'I',
	J: 'ſ',
	K: 'ʞ',
	L: '˥',
	M: 'W',
	N: 'N',
	O: 'O',
	P: 'Ԁ',
	Q: 'Q',
	R: 'ɹ',
	S: 'S',
	T: '┴',
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

const KEPT = /<a?:\w+:\d+>|<(?:@[!&]?|#)\d+>|<t:\d+(?::[a-zA-Z])?>|https?:\/\/\S+|:\w+:/g;

function flipText(text: string): string {
	return Array.from(text)
		.reverse()
		.map((character) => FLIPPED[character] ?? character)
		.join('');
}

function segments(text: string): string[] {
	const parts: string[] = [];
	let index = 0;

	for (const match of text.matchAll(KEPT)) {
		parts.push(flipText(text.slice(index, match.index)), match[0]);
		index = match.index + match[0].length;
	}

	parts.push(flipText(text.slice(index)));

	return parts;
}

/**
 * @description Turns text upside down, like upsidedowntext.com: it reverses the text and swaps each character for its upside-down look-alike.
 * Mentions, custom emoji, timestamps, `:emoji:` names and links stay readable so Discord still renders them.
 * @param text The text to flip.
 * @returns The upside-down text.
 */
export function flipUpsideDown(text: string): string {
	return segments(text).reverse().join('');
}

export default flipUpsideDown;
