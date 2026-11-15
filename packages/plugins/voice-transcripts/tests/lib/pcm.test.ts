import { describe, expect, test } from 'bun:test';

import { toMono } from '~/lib/pcm';

describe('toMono', () => {
	test('averages channels and shrinks 48 kHz to 16 kHz', () => {
		const stereo = new Int16Array([300, 100, 300, 100, 300, 100, 600, 0, 600, 0, 600, 0]);

		expect([...toMono(stereo, 48_000, 2)]).toEqual([200, 300]);
	});

	test('keeps a 16 kHz mono clip as it is', () => {
		expect([...toMono(new Int16Array([1, 2, 3]), 16_000, 1)]).toEqual([1, 2, 3]);
	});

	test('grows 8 kHz to 16 kHz by interpolating', () => {
		expect([...toMono(new Int16Array([0, 100]), 8_000, 1)]).toEqual([0, 50, 100, 100]);
	});
});
