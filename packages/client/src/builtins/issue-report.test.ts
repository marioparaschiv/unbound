import { describe, expect, test } from 'bun:test';

import { issueBody, issueURL } from './issue-report';

const info = {
	client: 'v0.11.0',
	commit: '402cbbf6',
	loader: '1.0.0',
	loaderOrigin: 'libunbound.so',
	framework: 'Vector',
	discord: '352.10',
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
	test('lists the environment the way /debug does, then the description template', () => {
		const body = issueBody(info);

		expect(body.startsWith('### Environment\n- **Unbound:** v0.11.0')).toBe(true);
		expect(body).toContain('- **Device:** Google Pixel 8 Pro on Android 15 (SDK 35)');
		expect(body).toContain('**Steps to reproduce:**');
		expect(body).not.toContain('### Entitlements');
	});

	test('includes the entitlements on iOS', () => {
		expect(issueBody({ ...info, platform: 'iOS' }, '<plist/>\n')).toContain(
			'### Entitlements\n```xml\n<plist/>\n```',
		);
	});

	test('opens a new issue in the Unbound repository with a platform title', () => {
		const url = new URL(issueURL(info));

		expect(url.pathname).toBe('/marioparaschiv/unbound/issues/new');
		expect(url.searchParams.get('title')).toBe(
			'bug(Android): replace this with a descriptive title',
		);
		expect(url.searchParams.get('body')).toBe(issueBody(info));
	});
});
