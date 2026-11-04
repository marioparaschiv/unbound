import { describe, expect, test } from 'bun:test';

import { flipUpsideDown } from '~/text/flip';

describe('flipUpsideDown', () => {
	test('matches upsidedowntext.com', () => {
		expect(flipUpsideDown('please wait a moment, i shall push a fix')).toBe(
			"xᴉɟ ɐ ɥsnd llɐɥs ᴉ 'ʇuǝɯoɯ ɐ ʇᴉɐʍ ǝsɐǝld",
		);
	});

	test('flips capitals, digits and punctuation', () => {
		expect(flipUpsideDown('Hello World 123!?')).toBe('¿¡ƐᄅƖ plɹoM ollǝH');
	});

	test('keeps mentions, emoji, timestamps and links readable', () => {
		expect(flipUpsideDown('hi <@224617799434108928> :wave: see https://unbound.rip ok')).toBe(
			'ʞo https://unbound.rip ǝǝs :wave: <@224617799434108928> ᴉɥ',
		);
		expect(flipUpsideDown('at <t:1700000000:R> <:cat:123>')).toBe(
			'<:cat:123> <t:1700000000:R> ʇɐ',
		);
	});

	test('reverses lines so the message reads upside down', () => {
		expect(flipUpsideDown('top\nbottom')).toBe('ɯoʇʇoq\ndoʇ');
	});

	test('leaves empty text alone', () => {
		expect(flipUpsideDown('')).toBe('');
	});
});
