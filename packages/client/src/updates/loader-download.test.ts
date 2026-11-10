import { describe, expect, test } from 'bun:test';

import { loaderDownloadUrl } from './loader-download';

const DEB = 'https://cdn.unbound.rip/loader/1.1.1/app.unbound.ios_1.1.1_iphoneos-arm64.deb';
const LATEST = 'https://github.com/marioparaschiv/unbound/releases/download/loader-latest';

describe('loaderDownloadUrl', () => {
	test('sends a sideloaded app to the newest IPA', () => {
		expect(loaderDownloadUrl(DEB, 'ipa')).toBe(`${LATEST}/Unbound.ipa`);
	});

	test('sends a patched Android app to the newest APKs', () => {
		expect(loaderDownloadUrl(DEB, 'apk')).toBe(`${LATEST}/Unbound.apks`);
	});

	test('keeps the release download for the tweak, module or an unknown install', () => {
		expect(loaderDownloadUrl(DEB, 'tweak')).toBe(DEB);
		expect(loaderDownloadUrl(DEB, 'module')).toBe(DEB);
		expect(loaderDownloadUrl(DEB, undefined)).toBe(DEB);
	});
});
