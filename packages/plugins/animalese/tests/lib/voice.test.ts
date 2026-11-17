import { describe, expect, test } from 'bun:test';

import { speakWav, spokenLetters, voiceFor } from '~/lib/voice';

describe('animalese voice', () => {
	test('speaks letters and digits, pausing between words, up to the limit', () => {
		expect(spokenLetters('Hi, you 2!', 10)).toEqual(['h', 'i', ' ', 'y', 'o', 'u', ' ', '2']);
		expect(spokenLetters('hello world', 4)).toEqual(['h', 'e', 'l', 'l']);
		expect(spokenLetters('  ...  ', 10)).toEqual([]);
	});

	test('keeps each person on one voice', () => {
		expect(voiceFor('224617799434108928')).toBe(voiceFor('224617799434108928'));
	});

	test('renders a WAV with silence for pauses', () => {
		const wav = speakWav(['a', ' ', 'b'], 'mid', 100);
		const perLetter = 1600;

		expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
		expect(wav.length).toBe(44 + perLetter * 3);
		expect(
			[...wav.subarray(44 + perLetter, 44 + perLetter * 2)].every((value) => value === 128),
		).toBe(true);
		expect([...wav.subarray(44 + 100, 44 + 400)].some((value) => value !== 128)).toBe(true);
	});
});
