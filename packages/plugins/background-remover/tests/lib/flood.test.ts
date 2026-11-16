import { describe, expect, test } from 'bun:test';

import { clearPlainBackground } from '~/lib/flood';

function picture(width: number, height: number, paint: (x: number, y: number) => number[]) {
	const pixels = new Uint8Array(width * height * 4);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) pixels.set([...paint(x, y), 255], (y * width + x) * 4);
	}

	return pixels;
}

const alphaAt = (pixels: Uint8Array, width: number, x: number, y: number) =>
	pixels[(y * width + x) * 4 + 3];

describe('clearing a plain background', () => {
	test('clears the background around a subject and keeps the subject', () => {
		const pixels = picture(40, 40, (x, y) =>
			Math.hypot(x - 20, y - 20) < 10 ? [200, 30, 30] : [250, 250, 250],
		);
		const result = clearPlainBackground(pixels, 40, 40);

		expect(result).toBeDefined();
		expect(alphaAt(result!, 40, 0, 0)).toBe(0);
		expect(alphaAt(result!, 40, 20, 20)).toBe(255);
	});

	test('keeps background-coloured areas inside the subject', () => {
		const pixels = picture(40, 40, (x, y) => {
			const distance = Math.hypot(x - 20, y - 20);

			return distance < 4 ? [250, 250, 250] : distance < 12 ? [20, 20, 200] : [250, 250, 250];
		});
		const result = clearPlainBackground(pixels, 40, 40)!;

		expect(alphaAt(result, 40, 20, 20)).toBe(255);
	});

	test('tolerates noise and gradients in the background', () => {
		const pixels = picture(40, 40, (x, y) =>
			Math.hypot(x - 20, y - 20) < 8
				? [0, 0, 0]
				: [230 + ((x * 7 + y * 3) % 9), 235 + (y % 5), 240],
		);
		const result = clearPlainBackground(pixels, 40, 40)!;

		expect(alphaAt(result, 40, 39, 39)).toBe(0);
		expect(alphaAt(result, 40, 20, 20)).toBe(255);
	});

	test('gives up on busy backgrounds', () => {
		const pixels = picture(40, 40, (x, y) => [
			(x * 53 + y * 97) % 256,
			(x * 31) % 256,
			(y * 71) % 256,
		]);

		expect(clearPlainBackground(pixels, 40, 40)).toBeUndefined();
	});
});
