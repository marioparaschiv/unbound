import { describe, expect, test } from 'bun:test';

import { onlyOnOtherPlatform } from '~/marketplace/platform-support';

describe('onlyOnOtherPlatform', () => {
	test('names the platform an addon is limited to', () => {
		expect(onlyOnOtherPlatform({ platforms: { ios: {} } }, 'android')).toBe('ios');
	});

	test('says nothing when the addon runs here or declares no platforms', () => {
		expect(
			onlyOnOtherPlatform({ platforms: { ios: {}, android: {} } }, 'android'),
		).toBeUndefined();
		expect(onlyOnOtherPlatform({ platforms: { ios: {} } }, 'ios')).toBeUndefined();
		expect(onlyOnOtherPlatform({}, 'android')).toBeUndefined();
	});
});
