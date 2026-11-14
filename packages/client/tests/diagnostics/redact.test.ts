import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from '~/diagnostics/format-debug-info';
import { redactReport, redactText } from '~/diagnostics/redact';

const SNOWFLAKE = /\b\d{17,20}\b/;
const TOKEN = /[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,40}/;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6 = /\b(?:[\da-f]{1,4}:){3,7}[\da-f]{1,4}\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

const token = `${'M'.repeat(26)}.GabcDE.${'x'.repeat(38)}`;

const report = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.4.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit',
	discord: '353.0',
	discordChannel: 'Stable',
	discordBuild: '122208',
	appSource: 'App Store',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1 (23A355)',
	device: 'iPhone SE (2nd generation)',
	flags: ['Jailbroken', 'verified build'],
	disabledAddons: ['Notes for 343383572805058560 (failed to start)'],
	injected: ['/Users/someone/Library/hook.dylib'],
	errors: [
		{ at: 1, message: `Failed to load channel 1234567890123456789 with ${token}` },
		{
			at: 2,
			message:
				'fetch to 203.0.113.9 and 2001:db8:85a3::8a2e:370:7334 failed for me@example.com',
		},
	],
	launch: {
		bundle: 'active' as const,
		earlyCloses: 0,
		recovery: false,
		previousExit: 'unknown' as const,
		lastCrash: 'SIGSEGV near 10.0.0.12',
		lastCheck: {
			at: 3,
			outcome: 'failed' as const,
			detail: 'GET https://cdn.example/b?token=abc123&v=2 timed out',
		},
	},
};

describe('redactReport', () => {
	test('leaves no IDs, tokens, IP or email addresses anywhere in /debug', () => {
		const text = JSON.stringify(redactReport(report)) + formatDebugInfo(redactReport(report));

		for (const pattern of [SNOWFLAKE, TOKEN, IPV4, IPV6, EMAIL]) {
			expect(text).not.toMatch(pattern);
		}

		expect(text).not.toContain('token=abc123');
		expect(text).not.toContain('/Users/someone');
	});

	test('keeps version fields and the redacted text readable', () => {
		const clean = redactReport(report);

		expect(clean.hermes).toBe('250829098.0.15');
		expect(clean.os).toBe('26.0.1 (23A355)');
		expect(clean.errors?.[0]?.message).toBe('Failed to load channel <id> with <token>');
		expect(clean.launch?.lastCheck?.detail).toBe(
			'GET https://cdn.example/b?token=<redacted>&v=2 timed out',
		);
	});

	test('does not mistake times, versions or short numbers for addresses', () => {
		expect(redactText('at 12:30:45, build 122208, React Native 0.86.0')).toBe(
			'at 12:30:45, build 122208, React Native 0.86.0',
		);
	});
});
