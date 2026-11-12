import { describe, expect, test } from 'bun:test';

import { packInset, yogaValue } from '~/bubbles/ios/content-inset';

function bytes(value: number) {
	const view = new DataView(new ArrayBuffer(8));

	view.setFloat64(0, value, true);

	return { points: view.getFloat32(0, true), unit: view.getInt32(4, true) };
}

describe('content inset', () => {
	test('packs a point value and Yoga undefined into the bytes of a YGValue', () => {
		expect(bytes(yogaValue(14))).toEqual({ points: 14, unit: 1 });
		expect(bytes(yogaValue()).points).toBeNaN();
		expect(bytes(yogaValue()).unit).toBe(0);
	});

	test('moves the content by the inset and narrows it by both sides', () => {
		const { left, right } = packInset(14);

		expect(bytes(left)).toEqual({ points: 14, unit: 1 });
		expect(bytes(right)).toEqual({ points: 28, unit: 1 });
		expect(bytes(packInset(0).left).unit).toBe(0);
	});
});
