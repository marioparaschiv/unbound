import { describe, expect, test } from 'bun:test';

import { ringColor } from '~/lib/status-color';

describe('ringColor', () => {
	test('colours each active status', () => {
		expect(ringColor('online', false)).toBe('#23a55a');
		expect(ringColor('idle', false)).toBe('#f0b232');
		expect(ringColor('dnd', false)).toBe('#f23f43');
		expect(ringColor('streaming', false)).toBe('#593695');
	});

	test('rings offline users only when asked', () => {
		expect(ringColor('offline', false)).toBeUndefined();
		expect(ringColor('invisible', true)).toBe('#80848e');
	});

	test('skips avatars without a known status', () => {
		expect(ringColor(undefined, true)).toBeUndefined();
		expect(ringColor('unknown', true)).toBeUndefined();
	});
});
