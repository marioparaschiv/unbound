import { describe, expect, test } from 'bun:test';

import { roleHex } from '~/lib/color';

describe('role color', () => {
	test('writes a padded hex code', () => {
		expect(roleHex(0x5865f2)).toBe('#5865F2');
		expect(roleHex(0xff)).toBe('#0000FF');
	});

	test('leaves a role without a color out', () => {
		expect(roleHex(0)).toBeUndefined();
		expect(roleHex(undefined)).toBeUndefined();
	});
});
