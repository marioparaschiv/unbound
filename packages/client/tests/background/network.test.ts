import { describe, expect, test } from 'bun:test';

import { onUnmeteredNetwork } from '~/background/network';

describe('onUnmeteredNetwork', () => {
	test('allows Wi-Fi and ethernet without a data limit', () => {
		expect(onUnmeteredNetwork({ type: 'wifi' })).toBe(true);
		expect(onUnmeteredNetwork({ type: 'ethernet' })).toBe(true);
	});

	test('refuses cellular, metered Wi-Fi, Low Data Mode and offline', () => {
		expect(onUnmeteredNetwork({ type: 'cellular' })).toBe(false);
		expect(onUnmeteredNetwork({ type: 'wifi', metered: true })).toBe(false);
		expect(onUnmeteredNetwork({ type: 'wifi', lowData: true })).toBe(false);
		expect(onUnmeteredNetwork({ type: 'offline' })).toBe(false);
	});
});
