import { describe, expect, test } from 'bun:test';

import { toDownloads } from '~/lib/downloads/builds';
import type { GitHubRelease } from '~/lib/github';

function release(name: string, publishedAt: string, assets: string[]): GitHubRelease {
	return {
		tag: name,
		name,
		prerelease: false,
		publishedAt,
		url: `https://github.com/marioparaschiv/unbound/releases/tag/${encodeURIComponent(name)}`,
		assets: assets.map((asset) => ({
			name: asset,
			size: 1,
			url: `https://example.com/${asset}`,
		})),
	};
}

describe('toDownloads', () => {
	test('picks the newest release on each track, sorted into its channel', () => {
		const downloads = toDownloads([
			release('Unbound 1.0.0 for Discord 351.11, Android', '2026-11-04T04:56:57Z', [
				'Unbound.apks',
			]),
			release('Unbound 1.0.971 for Discord 352.17, Android', '2026-11-05T00:05:18Z', [
				'Unbound.apks',
				'app.unbound.android.xposed.apk',
				'unbound-android-symbols.zip',
			]),
			release('Unbound 1.0.971 for Discord 352.1, iOS', '2026-11-05T00:05:02Z', [
				'app.unbound.ios_1.0.969_iphoneos-arm64.deb',
				'app.unbound.ios_1.0.971_iphoneos-arm64.deb',
				'app.unbound.ios_1.0.0_iphoneos-arm64.deb',
				'Unbound.ipa',
				'unbound-ios-simulator.zip',
			]),
			release(
				'Unbound 1.0.0 for Discord 353.0 (119349), iOS TestFlight',
				'2026-10-27T15:33:02Z',
				['Unbound.ipa'],
			),
			release('Unbound 1.0.973 for Discord 353.9, Android beta', '2026-11-05T18:08:40Z', [
				'Unbound-beta.apks',
			]),
			release('Unbound loader (latest)', '2026-11-05T12:28:44Z', ['Unbound.ipa']),
			release('devtools: v0.2.0', '2026-11-05T11:06:06Z', []),
		]);

		expect(downloads.stable.map((build) => [build.track, build.discordVersion])).toEqual([
			['ios', '352.1'],
			['android', '352.17'],
		]);
		expect(downloads.stable[0]?.files.map((file) => [file.kind, file.name])).toEqual([
			['ipa', 'Unbound.ipa'],
			['deb', 'app.unbound.ios_1.0.971_iphoneos-arm64.deb'],
		]);
		expect(downloads.stable[1]?.files.map((file) => file.kind)).toEqual(['apks', 'xposed']);
		expect(downloads.nightly.map((build) => [build.track, build.version])).toEqual([
			['ios-testflight', '1.0.0'],
			['android-beta', '1.0.973'],
		]);
	});

	test('leaves out a release with no installable file', () => {
		const downloads = toDownloads([
			release('Unbound 1.0.0 for Discord 354.0, Android alpha', '2026-11-02T22:32:28Z', [
				'unbound-android-symbols.zip',
			]),
		]);

		expect(downloads.nightly).toEqual([]);
	});
});
