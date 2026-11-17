export type VoiceName = 'low' | 'mid' | 'high' | 'squeaky';

const BASE_HZ: Record<VoiceName, number> = { low: 150, mid: 230, high: 330, squeaky: 470 };
const VOICES: VoiceName[] = ['low', 'mid', 'high', 'squeaky'];
const SAMPLE_RATE = 16_000;
const VOWEL_FORMANTS: Record<string, number> = { a: 800, e: 500, i: 300, o: 500, u: 330 };

/**
 * @description Picks a voice for someone from their user id, so each person keeps the same one.
 * @param userId The user id.
 * @returns The voice.
 */
export function voiceFor(userId: string): VoiceName {
	let hash = 0;

	for (let index = 0; index < userId.length; index++)
		hash = (hash * 31 + userId.charCodeAt(index)) | 0;

	return VOICES[Math.abs(hash) % VOICES.length]!;
}

/**
 * @description The letters a message is spoken as: letters and digits, lower-cased, with spaces kept as pauses, at most `limit` letters.
 * @param text The message.
 * @param limit The most letters to speak.
 * @returns The letters, with `' '` for pauses.
 */
export function spokenLetters(text: string, limit: number): string[] {
	const letters: string[] = [];
	let spoken = 0;

	for (const character of text.toLowerCase()) {
		if (/[a-z0-9]/.test(character)) {
			if (spoken >= limit) break;

			letters.push(character);
			spoken++;
		} else if (/\s/.test(character) && letters.length && letters.at(-1) !== ' ') {
			letters.push(' ');
		}
	}

	while (letters.at(-1) === ' ') letters.pop();

	return letters;
}

function pitchOf(letter: string, base: number): number {
	const code = letter.charCodeAt(0);
	const step = /[0-9]/.test(letter) ? code - 48 : code - 97;

	return base * (0.85 + (((step * 7) % 26) / 26) * 0.45);
}

function formantOf(letter: string): number {
	return VOWEL_FORMANTS[letter] ?? 600 + ((letter.charCodeAt(0) * 37) % 900);
}

function writeAscii(view: DataView, offset: number, text: string) {
	for (let index = 0; index < text.length; index++)
		view.setUint8(offset + index, text.charCodeAt(index));
}

/**
 * @description Speaks letters as a mono 8-bit WAV: each letter a short blip at a pitch set by the voice and the letter,
 * its harmonics shaped by a vowel-like formant, with pauses for spaces.
 * @param letters The letters from `spokenLetters`.
 * @param voice The voice.
 * @param letterMs How long each letter lasts, in milliseconds.
 * @returns The WAV file's bytes.
 */
export function speakWav(
	letters: readonly string[],
	voice: VoiceName,
	letterMs: number,
): Uint8Array {
	const perLetter = Math.round((letterMs / 1000) * SAMPLE_RATE);
	const samples = perLetter * letters.length;
	const bytes = new Uint8Array(44 + samples);
	const view = new DataView(bytes.buffer);

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

	letters.forEach((letter, index) => {
		if (letter === ' ') return;

		const pitch = pitchOf(letter, BASE_HZ[voice]);
		const formant = formantOf(letter);
		const start = 44 + index * perLetter;
		const voiced = Math.floor(perLetter * 0.8);

		for (let sample = 0; sample < voiced; sample++) {
			const time = sample / SAMPLE_RATE;
			const envelope =
				Math.min(1, sample / (SAMPLE_RATE * 0.006)) *
				Math.min(1, (voiced - sample) / (SAMPLE_RATE * 0.02));
			let value = 0;

			for (let harmonic = 1; harmonic <= 6; harmonic++) {
				const frequency = pitch * harmonic;
				const weight = 1 / (1 + Math.abs(frequency - formant) / 250) / harmonic;

				value += weight * Math.sin(2 * Math.PI * frequency * time);
			}

			bytes[start + sample] = Math.round(
				128 + Math.max(-1, Math.min(1, value * 0.9)) * envelope * 100,
			);
		}
	});

	return bytes;
}
