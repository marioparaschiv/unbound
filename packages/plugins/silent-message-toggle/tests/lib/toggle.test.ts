import { describe, expect, test } from 'bun:test';

import { withSilentFlag } from '~/lib/toggle';

describe('withSilentFlag', () => {
	test('sets SUPPRESS_NOTIFICATIONS on a message with no flags', () => {
		expect(withSilentFlag(undefined)).toBe(4096);
		expect(withSilentFlag(0)).toBe(4096);
	});

	test('keeps the other flags', () => {
		expect(withSilentFlag(8192)).toBe(8192 | 4096);
		expect(withSilentFlag(4)).toBe(4 | 4096);
	});

	test('is unchanged when the flag is already set', () => {
		expect(withSilentFlag(4096)).toBe(4096);
		expect(withSilentFlag(4096 | 8192)).toBe(4096 | 8192);
	});

	test('ignores flags that are not integers', () => {
		expect(withSilentFlag('4')).toBe(4096);
		expect(withSilentFlag(1.5)).toBe(4096);
		expect(withSilentFlag(null)).toBe(4096);
	});
});
