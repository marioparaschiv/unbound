import { describe, expect, test } from 'bun:test';

import { uwuify } from '~/lib/uwuify';

const plain = { stutter: false, faces: false };

describe('uwuify', () => {
	test('turns r and l into w and n before a vowel into ny', () => {
		expect(uwuify('really nice', plain)).toBe('weawwy nyice');
	});

	test('swaps whole words and keeps their case', () => {
		expect(uwuify('Hello, I love you', plain)).toBe('Hewwo, I wuv yuw');
	});

	test('leaves code, links, mentions and custom emoji alone', () => {
		const text = 'look `really` https://example.com/rl <@123> <:lol:456>';

		expect(uwuify(text, plain)).toBe('wook `really` https://example.com/rl <@123> <:lol:456>');
	});

	test('comes out the same each time', () => {
		const options = { stutter: true, faces: true };
		const text = 'Hello there. This is a really lovely message! Another one.';

		expect(uwuify(text, options)).toBe(uwuify(text, options));
	});
});
