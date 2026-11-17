import { describe, expect, test } from 'bun:test';

import { fontFormat, woffToSfnt } from '~/lib/woff';

function woff(tables: { tag: string; data: number[]; compressed?: number[] }[]): Uint8Array {
	const header = 44;
	const directory = tables.length * 20;
	const bodies = tables.map((table) => table.compressed ?? table.data);
	const size = bodies.reduce((total, body) => total + body.length, header + directory);
	const out = new Uint8Array(size);
	const view = new DataView(out.buffer);

	view.setUint32(0, 0x774f4646);
	view.setUint32(4, 0x00010000);
	view.setUint16(12, tables.length);

	let offset = header + directory;

	tables.forEach((table, index) => {
		const entry = header + index * 20;
		const body = bodies[index]!;

		for (let char = 0; char < 4; char++) out[entry + char] = table.tag.charCodeAt(char);
		view.setUint32(entry + 4, offset);
		view.setUint32(entry + 8, body.length);
		view.setUint32(entry + 12, table.data.length);
		view.setUint32(entry + 16, 0xabcd);
		out.set(body, offset);
		offset += body.length;
	});

	return out;
}

describe('fontFormat', () => {
	test('reads the signature', () => {
		expect(fontFormat(new Uint8Array([0, 1, 0, 0]))).toBe('sfnt');
		expect(fontFormat(new Uint8Array([0x4f, 0x54, 0x54, 0x4f]))).toBe('sfnt');
		expect(fontFormat(new Uint8Array([0x77, 0x4f, 0x46, 0x46]))).toBe('woff');
		expect(fontFormat(new Uint8Array([0x77, 0x4f, 0x46, 0x32]))).toBe('woff2');
		expect(fontFormat(new Uint8Array([1, 2]))).toBe('unknown');
	});
});

describe('woffToSfnt', () => {
	test('copies raw tables and inflates compressed ones into an aligned sfnt', () => {
		const file = woff([
			{ tag: 'head', data: [1, 2, 3] },
			{ tag: 'glyf', data: [9, 9, 9, 9, 9], compressed: [7, 7] },
		]);
		const sfnt = woffToSfnt(file, (compressed, length) => {
			expect(compressed).toEqual(new Uint8Array([7, 7]));

			return new Uint8Array(length).fill(9);
		});
		const view = new DataView(sfnt.buffer);

		expect(view.getUint32(0)).toBe(0x00010000);
		expect(view.getUint16(4)).toBe(2);
		expect(String.fromCharCode(...sfnt.subarray(12, 16))).toBe('head');
		expect(view.getUint32(12 + 4)).toBe(0xabcd);

		const headOffset = view.getUint32(12 + 8);
		const glyfOffset = view.getUint32(28 + 8);

		expect([...sfnt.subarray(headOffset, headOffset + 3)]).toEqual([1, 2, 3]);
		expect(glyfOffset % 4).toBe(0);
		expect([...sfnt.subarray(glyfOffset, glyfOffset + 5)]).toEqual([9, 9, 9, 9, 9]);
		expect(sfnt.byteLength % 4).toBe(0);
	});
});
