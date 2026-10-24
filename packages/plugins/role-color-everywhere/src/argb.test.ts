import { describe, expect, test } from 'bun:test';

import { blendArgb, hexToArgb } from '~/argb';

describe('blendArgb', () => {
	test('mixes in Oklab like Vencord, keeping the base alpha', () => {
		expect(blendArgb(0xffffffff, 0xff000000, 50)).toBe(0xff636363 | 0);
		expect(blendArgb(0x80ffffff, 0xff000000, 0)).toBe(0x80ffffff | 0);
		expect(blendArgb(0x80ffffff, 0xff000000, 100)).toBe(0x80000000 | 0);
	});

	test('stays in the signed 32-bit range the chat renderer expects', () => {
		const color = blendArgb(0xffeeeeee, 0xff112233, 30);

		expect(color).toBe(color | 0);
	});
});

test('hexToArgb makes opaque colors and rejects other strings', () => {
	expect(hexToArgb('#112233')).toBe(0xff112233 | 0);
	expect(hexToArgb('red')).toBeNull();
});
