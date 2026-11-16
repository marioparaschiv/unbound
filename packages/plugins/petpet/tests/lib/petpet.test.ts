import { describe, expect, test } from 'bun:test';

import { FRAME_COUNT, FRAME_SIZE, petpetFrames } from '~/lib/petpet';

function solid(size: number, [r, g, b]: [number, number, number]): Uint8Array {
	const pixels = new Uint8Array(size * size * 4);

	for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([r, g, b, 255], offset);

	return pixels;
}

function pixel(frame: Uint8Array, x: number, y: number) {
	const offset = (y * FRAME_SIZE + x) * 4;

	return [...frame.subarray(offset, offset + 4)];
}

describe('petpet frames', () => {
	const frames = petpetFrames(solid(64, [0, 128, 255]), 64);

	test('makes square frames of the right size', () => {
		expect(frames).toHaveLength(FRAME_COUNT);
		for (const frame of frames) expect(frame.length).toBe(FRAME_SIZE * FRAME_SIZE * 4);
	});

	test('keeps the corners transparent and the avatar in a circle at the bottom', () => {
		expect(pixel(frames[0]!, 0, FRAME_SIZE - 1)[3]).toBe(0);
		expect(pixel(frames[0]!, FRAME_SIZE / 2, FRAME_SIZE - 20)).toEqual([0, 128, 255, 255]);
	});

	test('draws the hand above the avatar', () => {
		const top = frames[0]!.subarray(0, FRAME_SIZE * 30 * 4);
		let handPixels = 0;

		for (let offset = 0; offset < top.length; offset += 4) {
			if (top[offset + 3] === 255 && top[offset]! > 200 && top[offset + 2]! < 200)
				handPixels++;
		}

		expect(handPixels).toBeGreaterThan(200);
	});

	test('squishes the avatar halfway through the pat', () => {
		const opaqueRows = (frame: Uint8Array) => {
			let rows = 0;

			for (let y = 40; y < FRAME_SIZE; y++)
				if (pixel(frame, FRAME_SIZE / 2, y)[2] === 255) rows++;

			return rows;
		};

		expect(opaqueRows(frames[FRAME_COUNT / 2]!)).toBeLessThan(opaqueRows(frames[0]!));
	});
});
