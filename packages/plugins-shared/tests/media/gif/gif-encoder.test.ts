import { describe, expect, test } from 'bun:test';

import { encodeGif } from '~/media/gif/gif-encoder';
import { buildPalette } from '~/media/gif/palette';

function solid(width: number, height: number, [r, g, b]: number[]): Uint8Array {
	const frame = new Uint8Array(width * height * 4);

	for (let offset = 0; offset < frame.length; offset += 4) frame.set([r!, g!, b!, 255], offset);

	return frame;
}

describe('buildPalette', () => {
	test('keeps distinct colours apart', () => {
		const palette = buildPalette([solid(4, 4, [255, 0, 0]), solid(4, 4, [0, 0, 255])]);
		const red = palette.lookup(250, 5, 5);
		const blue = palette.lookup(5, 5, 250);

		expect(red).not.toBe(blue);
		expect(palette.colors[red * 3]).toBeGreaterThan(200);
		expect(palette.colors[blue * 3 + 2]).toBeGreaterThan(200);
	});
});

describe('encodeGif', () => {
	test('writes a looping GIF89a with one image per frame', () => {
		const frames = [
			solid(8, 6, [255, 0, 0]),
			solid(8, 6, [0, 255, 0]),
			solid(8, 6, [0, 0, 255]),
		];
		const gif = encodeGif(frames, {
			width: 8,
			height: 6,
			delayCentiseconds: 10,
			palette: buildPalette(frames),
		});
		const text = String.fromCharCode(...gif);

		expect(text.startsWith('GIF89a')).toBe(true);
		expect(text).toContain('NETSCAPE2.0');
		expect(gif[6]).toBe(8);
		expect(gif.at(-1)).toBe(0x3b);
		expect(text.split('\x21\xf9\x04').length - 1).toBe(3);
	});
});

test('keeps transparent pixels see-through with a reserved index', () => {
	const frame = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0]);
	const palette = buildPalette([frame], 255);
	const gif = encodeGif([frame], {
		width: 2,
		height: 2,
		delayCentiseconds: 10,
		palette,
		transparent: true,
	});
	const control = gif.indexOf(0xf9);

	expect(gif[control + 2]).toBe(0x09);
	expect(gif[control + 5]).toBe(255);
});

test('keeps splitting colours when one colour outweighs the rest', () => {
	const frame = new Uint8Array(4 * 2000);

	for (let pixel = 0; pixel < 2000; pixel++) {
		const color = pixel < 1500 ? [250, 250, 250] : [(pixel % 64) * 4, 0, 0];

		frame.set([...color, 255], pixel * 4);
	}

	expect(buildPalette([frame], 64).size).toBeGreaterThan(30);
});
