import { describe, expect, test } from 'bun:test';

import { cornerRadius } from '~/avatars/radius';

describe('avatar radius', () => {
	test('never rounds an avatar past a circle', () => {
		expect(cornerRadius(8, 40)).toBe(8);
		expect(cornerRadius(30, 40)).toBe(20);
		expect(cornerRadius(8, 0)).toBe(8);
	});
});
