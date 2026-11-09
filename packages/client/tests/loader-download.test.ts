import { describe, expect, test } from 'bun:test';

import { loaderDownloadUrl } from '~/updates/loader-download';

const RELEASES = 'https://github.com/marioparaschiv/unbound/releases/download';
const DEB = `${RELEASES}/discord-352.1-ios/app.unbound.ios_1.0.971_iphoneos-arm64.deb`;
const MODULE = `${RELEASES}/discord-352.17-android/app.unbound.android.xposed.apk`;

describe('loaderDownloadUrl', () => {
	test('sends a sideloaded app to the IPA in the same release', () => {
		expect(loaderDownloadUrl(DEB, 'ipa')).toBe(`${RELEASES}/discord-352.1-ios/Unbound.ipa`);
	});

	test('keeps the tweak on its .deb', () => {
		expect(loaderDownloadUrl(DEB, 'tweak')).toBe(DEB);
	});

	test('sends a patched Discord to the patched APKs and keeps the module on its APK', () => {
		expect(loaderDownloadUrl(MODULE, 'apk')).toBe(
			`${RELEASES}/discord-352.17-android/Unbound.apks`,
		);
		expect(loaderDownloadUrl(MODULE, 'module')).toBe(MODULE);
	});

	test('leaves a release page or an unknown install alone', () => {
		const page = 'https://github.com/marioparaschiv/unbound/releases/tag/discord-352.1-ios';

		expect(loaderDownloadUrl(page, 'ipa')).toBe(page);
		expect(loaderDownloadUrl(DEB, undefined)).toBe(DEB);
	});
});
