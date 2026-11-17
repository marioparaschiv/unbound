import { describe, expect, test } from 'bun:test';

import { decodeMorse, encodeMorse, isMorse, morseTimings, morseWav, unitFor } from '~/lib/morse';

describe('morse', () => {
	test('encodes words apart by slashes and drops what has no code', () => {
		expect(encodeMorse('SOS help!')).toBe('... --- ... / .... . .-.. .--. -.-.--');
		expect(encodeMorse('a ☃ b')).toBe('.- / -...');
	});

	test('decodes, reading look-alike dots and dashes', () => {
		expect(decodeMorse('... --- ... / .... . .-.. .--.')).toBe('SOS HELP');
		expect(decodeMorse('·−·· −−−')).toBe('LO');
		expect(decodeMorse('...... ---')).toBe('?O');
	});

	test('tells Morse messages apart from others', () => {
		expect(isMorse('... --- ...')).toBe(true);
		expect(isMorse('...')).toBe(true);
		expect(isMorse('..')).toBe(false);
		expect(isMorse('hello ...')).toBe(false);
	});

	test('times signals and gaps by the standard units', () => {
		expect(morseTimings('.- .', 100)).toEqual([0, 100, 100, 300, 300, 100]);
		expect(morseTimings('. / .', 100)).toEqual([0, 100, 700, 100]);
		expect(unitFor(20)).toBe(60);
	});

	test('renders a WAV as long as the timings', () => {
		const wav = morseWav([0, 100, 100, 300]);

		expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
		expect(wav.length).toBe(44 + 4000);
		expect(wav[44 + 101]).not.toBe(128);
		expect(wav[44 + 1200]).toBe(128);
	});
});
