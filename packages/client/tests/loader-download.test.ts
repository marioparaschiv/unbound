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

	test('sends a CDN loader release to the newest app build', () => {
		const cdn = 'https://cdn.unbound.rip/loader/1.1.1/app.unbound.ios_1.1.1_iphoneos-arm64.deb';
		const latest = `${RELEASES}/loader-latest`;

		expect(loaderDownloadUrl(cdn, 'ipa')).toBe(`${latest}/Unbound.ipa`);
		expect(loaderDownloadUrl(cdn, 'apk')).toBe(`${latest}/Unbound.apks`);
		expect(loaderDownloadUrl(cdn, 'tweak')).toBe(cdn);
	});

	test('leaves a release page or an unknown install alone', () => {
		const page = 'https://github.com/marioparaschiv/unbound/releases/tag/discord-352.1-ios';

		expect(loaderDownloadUrl(page, 'ipa')).toBe(page);
		expect(loaderDownloadUrl(DEB, undefined)).toBe(DEB);
	});
});
