import { describe, expect, test } from 'bun:test';

import { encodeGif } from '~/lib/gif-encoder';
import { buildPalette } from '~/lib/palette';

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
