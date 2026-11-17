import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { describe, expect, test } from 'bun:test';

import { crashIssueBody } from '~/lib/crash-issues/issue-text';

const report: CrashReport = {
	kind: 'native-crash',
	platform: 'android',
	clientVersion: '3.7.0',
	loaderVersion: '1.8.0',
	discordVersion: '352.10',
	osVersion: '15',
	deviceModel: 'Pixel 8',
	stack: 'Signal 11\n#0 0x1 libunbound.so + 0x10',
	context: {
		discordBuild: '352010',
		installSource: 'Google Play',
		injected: ['libfrida.so'],
		addons: ['unbound.chat-bubbles@1.4.0', 'unbound.emoji-packs@1.0.0'],
		breadcrumbs: ['12:00:01 navigation: <id>'],
	},
};

describe('crashIssueBody', () => {
	test('lists the context that names no one, and keeps breadcrumbs off the issue', () => {
		const body = crashIssueBody(report, 'report-1', 'fingerprint');

		expect(body).toContain('| Discord build | 352010 |');
		expect(body).toContain('| Installed from | Google Play |');
		expect(body).toContain('| Injected | libfrida.so |');
		expect(body).toContain('<summary>Enabled addons (2)</summary>');
		expect(body).toContain('- `unbound.emoji-packs@1.0.0`');
		expect(body).not.toContain('navigation');
	});

	test('leaves the context out of reports from older clients', () => {
		const body = crashIssueBody({ ...report, context: undefined }, 'report-2', 'fingerprint');

		expect(body).not.toContain('Enabled addons');
		expect(body).not.toContain('Discord build');
	});
});
