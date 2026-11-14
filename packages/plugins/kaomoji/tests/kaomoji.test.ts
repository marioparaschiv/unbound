import { describe, expect, test } from 'bun:test';

import { KAOMOJI, withKaomoji } from '~/kaomoji';

describe('withKaomoji', () => {
	test('sends the kaomoji alone without a message', () => {
		expect(withKaomoji('smug')).toBe('ಠ_ಠ');
		expect(withKaomoji('smug', '   ')).toBe('ಠ_ಠ');
	});

	test('puts the kaomoji after the message', () => {
		expect(withKaomoji('happy', ' done ')).toBe('done ヽ(´▽`)/');
	});

	test('covers every command', () => {
		expect(Object.keys(KAOMOJI)).toHaveLength(11);
	});
});
