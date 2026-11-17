const CODES: Record<string, string> = {
	a: '.-',
	b: '-...',
	c: '-.-.',
	d: '-..',
	e: '.',
	f: '..-.',
	g: '--.',
	h: '....',
	i: '..',
	j: '.---',
	k: '-.-',
	l: '.-..',
	m: '--',
	n: '-.',
	o: '---',
	p: '.--.',
	q: '--.-',
	r: '.-.',
	s: '...',
	t: '-',
	u: '..-',
	v: '...-',
	w: '.--',
	x: '-..-',
	y: '-.--',
	z: '--..',
	'0': '-----',
	'1': '.----',
	'2': '..---',
	'3': '...--',
	'4': '....-',
	'5': '.....',
	'6': '-....',
	'7': '--...',
	'8': '---..',
	'9': '----.',
	'.': '.-.-.-',
	',': '--..--',
	'?': '..--..',
	"'": '.----.',
	'!': '-.-.--',
	'/': '-..-.',
	'(': '-.--.',
	')': '-.--.-',
	'&': '.-...',
	':': '---...',
	';': '-.-.-.',
	'=': '-...-',
	'+': '.-.-.',
	'-': '-....-',
	_: '..--.-',
	'"': '.-..-.',
	$: '...-..-',
	'@': '.--.-.',
};

const LETTERS = new Map(Object.entries(CODES).map(([letter, code]) => [code, letter]));
const MORSE_ONLY = /^[.\-/\s·•−–—_]+$/;
const DOT_LIKE = /[·•]/g;
const DASH_LIKE = /[−–—_]/g;

/**
 * @description Writes text in Morse code: letters apart by a space, words by ` / `. Characters Morse has no code for are dropped.
 * @param text The text.
 * @returns The Morse code.
 */
export function encodeMorse(text: string): string {
	return text
		.toLowerCase()
		.split(/\s+/)
		.map((word) => lettersOf(word).join(' '))
		.filter(Boolean)
		.join(' / ');
}

function lettersOf(word: string): string[] {
	const codes: string[] = [];

	for (const character of word) {
		const code = CODES[character];

		if (code) codes.push(code);
	}

	return codes;
}

function writeAscii(view: DataView, offset: number, text: string) {
	for (let index = 0; index < text.length; index++) {
		view.setUint8(offset + index, text.charCodeAt(index));
	}
}

function normalized(code: string): string {
	return code.replace(DOT_LIKE, '.').replace(DASH_LIKE, '-').trim();
}

/**
 * @description Reads Morse code back as text, upper case as operators write it; an unknown sequence becomes `?`.
 * @param code The Morse code, words apart by `/` or three spaces.
 * @returns The text.
 */
export function decodeMorse(code: string): string {
	return normalized(code)
		.split(/\s*\/\s*|\s{3,}/)
		.map((word) =>
			word
				.split(/\s+/)
				.filter(Boolean)
				.map((sequence) => LETTERS.get(sequence) ?? '?')
				.join(''),
		)
		.filter(Boolean)
		.join(' ')
		.toUpperCase();
}

/**
 * @description Whether a message is Morse code: only dots, dashes, slashes and spaces, with at least three signals.
 * @param text The message.
 * @returns Whether to offer decoding it.
 */
export function isMorse(text: string | undefined): boolean {
	return Boolean(
		text && MORSE_ONLY.test(text) && (normalized(text).match(/[.-]/g)?.length ?? 0) >= 3,
	);
}

/**
 * @description Times Morse code for playback: a dot is one unit on, a dash three, with one unit between signals, three
 * between letters and seven between words.
 * @param code The Morse code.
 * @param unitMs One unit, in milliseconds.
 * @returns Alternating off and on durations, starting with off, as `Vibration.vibrate` takes them.
 */
export function morseTimings(code: string, unitMs: number): number[] {
	const timings: number[] = [0];
	let gap = 0;

	for (const character of normalized(code)) {
		if (character === '.' || character === '-') {
			timings[timings.length - 1]! += gap;
			timings.push(character === '.' ? unitMs : unitMs * 3, 0);
			gap = unitMs;
		} else if (character === '/') {
			gap = unitMs * 7;
		} else if (gap < unitMs * 3) {
			gap = unitMs * 3;
		}
	}

	timings.pop();

	return timings.length > 1 ? timings : [];
}

/**
 * @description Unit length from a speed in words per minute, by the PARIS standard.
 * @param wordsPerMinute The speed.
 * @returns One unit, in milliseconds.
 */
export function unitFor(wordsPerMinute: number): number {
	return Math.round(1200 / wordsPerMinute);
}

const SAMPLE_RATE = 8000;
const TONE_HZ = 600;

/**
 * @description Renders timings as a mono 8-bit WAV of a 600 Hz tone, with short fades so signals don't click.
 * @param timings Alternating off and on durations from `morseTimings`.
 * @returns The WAV file's bytes.
 */
export function morseWav(timings: number[]): Uint8Array {
	const total = timings.reduce((sum, duration) => sum + duration, 0);
	const samples = Math.ceil((total / 1000) * SAMPLE_RATE);
	const bytes = new Uint8Array(44 + samples);
	const view = new DataView(bytes.buffer);
	const fade = SAMPLE_RATE * 0.004;

	writeAscii(view, 0, 'RIFF');
	view.setUint32(4, 36 + samples, true);
	writeAscii(view, 8, 'WAVEfmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, SAMPLE_RATE, true);
	view.setUint32(28, SAMPLE_RATE, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	writeAscii(view, 36, 'data');
	view.setUint32(40, samples, true);
	bytes.fill(128, 44);

	let start = 0;

	timings.forEach((duration, index) => {
		const from = Math.floor((start / 1000) * SAMPLE_RATE);
		const to = Math.floor(((start + duration) / 1000) * SAMPLE_RATE);

		if (index % 2 === 1) {
			for (let sample = from; sample < to && sample < samples; sample++) {
				const envelope = Math.min(1, (sample - from) / fade, (to - sample) / fade);
				const value = Math.sin((2 * Math.PI * TONE_HZ * sample) / SAMPLE_RATE) * envelope;

				bytes[44 + sample] = Math.round(128 + value * 100);
			}
		}

		start += duration;
	});

	return bytes;
}
