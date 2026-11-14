import { describe, expect, test } from 'bun:test';

import { pngSize } from '~/lib/png';

describe('pngSize', () => {
	test('reads the size from the header', () => {
		const header = new Uint8Array(24);

		header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		new DataView(header.buffer).setUint32(16, 300);
		new DataView(header.buffer).setUint32(20, 150);

		expect(pngSize(header)).toEqual({ width: 300, height: 150 });
	});

	test('refuses anything else', () => {
		expect(pngSize(new Uint8Array(24))).toBeUndefined();
		expect(pngSize(new Uint8Array(4))).toBeUndefined();
	});
});
