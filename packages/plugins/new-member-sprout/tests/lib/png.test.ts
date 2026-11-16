import { expect, test } from 'bun:test';

import { maskedPng } from '~/lib/png';

test('encodes a valid PNG with the color and the mask as alpha', () => {
	const bytes = Uint8Array.from(maskedPng([0, 128, 255, 64], 2, [1, 2, 3]));
	const length = new DataView(bytes.buffer).getUint32(33);
	const idat = bytes.slice(41, 41 + length);

	expect([...bytes.slice(1, 4)].map((byte) => String.fromCharCode(byte)).join('')).toBe('PNG');
	expect([...Bun.inflateSync(idat.slice(2, -4))]).toEqual([
		0, 1, 2, 3, 0, 1, 2, 3, 128, 0, 1, 2, 3, 255, 1, 2, 3, 64,
	]);
});
