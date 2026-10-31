import { describe, expect, test } from 'bun:test';

import { issueEnvironment, issueURL } from './issue-report';

const info = {
	client: 'v0.11.0',
	commit: '402cbbf6',
	loader: '1.0.0',
	loaderOrigin: 'libunbound.so',
	framework: 'Vector',
	discord: '352.10',
	discordChannel: 'Stable',
	discordBuild: '352110',
	appSource: 'Google Play',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'Android',
	os: '15 (SDK 35)',
	device: 'Google Pixel 8 Pro',
	flags: ['rooted'],
};

describe('issue report', () => {
	test('lists the environment the way /debug does', () => {
		const environment = issueEnvironment(info);

		expect(environment.startsWith('- **Unbound:** v0.11.0')).toBe(true);
		expect(environment).toContain('- **Device:** Google Pixel 8 Pro on Android 15 (SDK 35)');
		expect(environment).not.toContain('### Entitlements');
	});

	test('includes the entitlements on iOS', () => {
		expect(issueEnvironment({ ...info, platform: 'iOS' }, '<plist/>\n')).toContain(
			'### Entitlements\n```xml\n<plist/>\n```',
		);
	});

	test('opens the bug report form with the platform and environment filled in', () => {
		const url = new URL(issueURL(info));

		expect(url.pathname).toBe('/marioparaschiv/unbound/issues/new');
		expect(url.searchParams.get('template')).toBe('bug-report.yml');
		expect(url.searchParams.get('platform')).toBe('Android');
		expect(url.searchParams.get('environment')).toBe(issueEnvironment(info));
	});
});
