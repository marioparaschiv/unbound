import { inflateSync } from 'node:zlib';
import { describe, expect, test } from 'bun:test';

import { cleanPrefix, cutTiles, gridFor, mosaicText, TILE } from '~/lib/tiles';
import { crc32, encodePng } from '~/lib/png';

describe('gridFor', () => {
	test('keeps the artwork shape', () => {
		expect(gridFor(4, 800, 400)).toEqual({ columns: 4, rows: 2 });
		expect(gridFor(3, 100, 0)).toEqual({ columns: 3, rows: 3 });
		expect(gridFor(2, 1000, 10)).toEqual({ columns: 2, rows: 1 });
	});
});

describe('cleanPrefix', () => {
	test('keeps only what emoji names allow, short enough for the suffix', () => {
		expect(cleanPrefix('my cat!')).toBe('mycat');
		expect(cleanPrefix('a'.repeat(40))).toHaveLength(26);
	});
});

describe('cutTiles', () => {
	test('cuts the right pixels into each tile, row by row', () => {
		const grid = { columns: 2, rows: 1 };
		const rgba = new Uint8Array(2 * TILE * TILE * 4);

		for (let y = 0; y < TILE; y++) rgba[(y * 2 * TILE + TILE) * 4] = 255;

		const tiles = cutTiles(rgba, grid, 'cat');

		expect(tiles.map(({ name }) => name)).toEqual(['cat_r1c1', 'cat_r1c2']);
		expect(tiles[0]!.rgba[0]).toBe(0);
		expect(tiles[1]!.rgba[0]).toBe(255);
		expect(tiles[1]!.rgba[(TILE - 1) * TILE * 4]).toBe(255);
	});
});

describe('mosaicText', () => {
	test('puts one row of emoji per line', () => {
		const uploaded = ['a', 'b', 'c', 'd'].map((name, index) => ({ name, id: String(index) }));

		expect(mosaicText(uploaded, 2)).toBe('<:a:0><:b:1>\n<:c:2><:d:3>');
	});
});

describe('encodePng', () => {
	test('writes a PNG whose pixels inflate back unchanged', () => {
		const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, index) => index * 7);
		const png = encodePng(rgba, 3, 2);
		const view = new DataView(png.buffer);

		expect([...png.subarray(1, 4)].map((byte) => String.fromCharCode(byte)).join('')).toBe(
			'PNG',
		);
		expect(view.getUint32(16)).toBe(3);
		expect(view.getUint32(20)).toBe(2);

		const idatLength = view.getUint32(33);
		const raw = inflateSync(png.subarray(41, 41 + idatLength));

		expect([...raw.subarray(1, 13)]).toEqual([...rgba.subarray(0, 12)]);
		expect([...raw.subarray(14, 26)]).toEqual([...rgba.subarray(12, 24)]);
	});

	test('matches the standard CRC-32', () => {
		expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
	});
});
