import { buildPalette } from '@unbound-plugins/shared/media/gif/palette';
import { encodeGif } from '@unbound-plugins/shared/media/gif/gif-encoder';
import { describe, expect, test } from 'bun:test';

import { analyseFlashes, flashTimes, type TimedFrame } from '~/lib/flashes';
import { decodeGif } from '~/lib/gif-decoder';

const SIZE = 16;

function solid(value: number): Uint8Array {
	const rgba = new Uint8Array(SIZE * SIZE * 4).fill(value);

	for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;

	return rgba;
}

function frames(values: number[], stepMs: number): TimedFrame[] {
	return values.map((value, index) => ({
		rgba: solid(value),
		width: SIZE,
		height: SIZE,
		atMs: index * stepMs,
	}));
}

describe('flashTimes', () => {
	test('counts a flash for each pair of opposing large changes', () => {
		expect(flashTimes([0, 1, 0, 1, 0], [0, 100, 200, 300, 400])).toEqual([200, 300, 400]);
	});

	test('ignores small changes and changes between two bright states', () => {
		expect(flashTimes([0.3, 0.35, 0.3, 0.35], [0, 1, 2, 3])).toEqual([]);
		expect(flashTimes([0.85, 1, 0.85, 1], [0, 1, 2, 3])).toEqual([]);
	});
});

describe('analyseFlashes', () => {
	test('flags full-screen black and white at 10 Hz', () => {
		const report = analyseFlashes(
			frames(
				Array.from({ length: 20 }, (_, index) => (index % 2 ? 255 : 0)),
				50,
			),
		);

		expect(report.flagged).toBe(true);
		expect(report.worst!.flashes).toBeGreaterThan(3);
	});

	test('passes a slow fade and a two-per-second blink', () => {
		expect(
			analyseFlashes(
				frames(
					Array.from({ length: 30 }, (_, index) => index * 8),
					100,
				),
			).flagged,
		).toBe(false);
		expect(analyseFlashes(frames([0, 255, 0, 255, 0], 500)).flagged).toBe(false);
	});

	test('passes flashing confined to a small corner', () => {
		const corner = Array.from({ length: 20 }, (_, index) => {
			const rgba = solid(40);

			if (index % 2)
				for (let y = 0; y < 4; y++)
					for (let x = 0; x < 4; x++)
						rgba.fill(255, (y * SIZE + x) * 4, (y * SIZE + x) * 4 + 3);

			return { rgba, width: SIZE, height: SIZE, atMs: index * 50 };
		});

		expect(analyseFlashes(corner).flagged).toBe(false);
	});
});

describe('decodeGif', () => {
	test('reads back every frame and its delay from an encoded GIF', () => {
		const source = [solid(0), solid(255), solid(0)];
		const gif = encodeGif(source, {
			width: SIZE,
			height: SIZE,
			delayCentiseconds: 5,
			palette: buildPalette(source),
		});
		const decoded = decodeGif(gif);

		expect(decoded.width).toBe(SIZE);
		expect(decoded.frames).toHaveLength(3);
		expect(decoded.frames[0]!.delayMs).toBe(50);
		expect(decoded.frames[1]!.rgba[0]).toBeGreaterThan(240);
		expect(decoded.frames[2]!.rgba[0]).toBeLessThan(15);
	});
});
