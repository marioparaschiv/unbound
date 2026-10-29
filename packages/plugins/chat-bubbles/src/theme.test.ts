import { describe, expect, mock, test } from 'bun:test';

mock.module('@unbound-app/api', () => ({ metro: { findStore: () => ({ theme: 'dark' }) } }));

const { argb } = await import('./theme');

describe('bubble colors', () => {
	test('packs translucent black and white into ARGB', () => {
		expect(argb({ red: 0, green: 0, blue: 0, alpha: 0.4 })).toBe(0x66000000);
		expect(argb({ red: 1, green: 1, blue: 1, alpha: 0.4 })).toBe(0x66ffffff);
	});
});
