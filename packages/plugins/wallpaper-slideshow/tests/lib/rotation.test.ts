import { describe, expect, test } from 'bun:test';

import { nextPosition, usableLinks } from '~/lib/rotation';

describe('wallpaper rotation', () => {
	test('goes in order and wraps', () => {
		expect(nextPosition(0, 3, false, 0)).toBe(1);
		expect(nextPosition(2, 3, false, 0)).toBe(0);
		expect(nextPosition(5, 0, false, 0)).toBe(0);
	});

	test('shuffles without repeating the current one', () => {
		for (const random of [0, 0.4, 0.99]) {
			expect(nextPosition(1, 4, true, random)).not.toBe(1);
		}
	});

	test('keeps web links only', () => {
		expect(usableLinks([' https://a.png ', 'ftp://b', 'not a link', 'http://c.jpg'])).toEqual([
			'https://a.png',
			'http://c.jpg',
		]);
	});
});
