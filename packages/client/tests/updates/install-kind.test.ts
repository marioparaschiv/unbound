import { describe, expect, test } from 'bun:test';

import { classifyInstall } from '~/updates/install-kind';

describe('classifyInstall', () => {
	test('tells a jailbreak tweak from an IPA on iOS', () => {
		const ios = { os: 'ios', patched: false };

		expect(classifyInstall({ ...ios, rooted: true, appSource: 'App Store' })).toBe('tweak');
		expect(classifyInstall({ ...ios, rooted: true, appSource: 'TestFlight' })).toBe('tweak');
		expect(classifyInstall({ ...ios, rooted: true, appSource: 'TrollStore' })).toBe('ipa');
		expect(classifyInstall({ ...ios, rooted: false, appSource: 'Sideloaded' })).toBe('ipa');
		expect(classifyInstall({ ...ios, rooted: false, appSource: 'App Store' })).toBe('ipa');
	});

	test('tells a patched APK from a framework module on Android', () => {
		const android = { os: 'android', rooted: false, appSource: '' };

		expect(classifyInstall({ ...android, patched: true })).toBe('apk');
		expect(classifyInstall({ ...android, patched: false })).toBe('module');
	});

	test('knows no install on other platforms', () => {
		expect(
			classifyInstall({ os: 'web', rooted: false, appSource: '', patched: false }),
		).toBeUndefined();
	});
});
