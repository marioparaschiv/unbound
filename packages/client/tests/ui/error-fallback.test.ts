import { describe, expect, test } from 'bun:test';

import {
	bugReportURL,
	crashDiagnostics,
	describeError,
	ISSUES_URL,
	pluginsLine,
	readableStack,
} from '~/ui/error-fallback';

function crash(message = 'Cannot read property x of undefined') {
	const error = new TypeError(message);

	error.stack = `TypeError: ${message}\n    at render (plugin.js:1:2)`;

	return error;
}

describe('error fallback', () => {
	test('describes the error, its stack and the component stack', () => {
		const described = describeError({
			error: crash(),
			componentStack: '\n    in Row\n    in List\n',
		});

		expect(described).toContain('TypeError: Cannot read property x of undefined');
		expect(described).toContain('at render (plugin.js:1:2)');
		expect(described).toContain('in Row');
		expect(described).toContain('in List');
		expect(describeError({ error: new Error('plain') })).toStartWith('Error: plain');
	});

	test('cuts each stack frame to its function name', () => {
		const stack =
			'Error: x\n    at render (address at http://10.0.2.2:3320/unbound.js:1:2)\n    at anonymous (native)';

		expect(readableStack(stack)).toBe('Error: x\nat render\nat anonymous');
		expect(readableStack('\n    at Row (<anonymous>)\n    at List (bundle:1:2)\n')).toBe(
			'at Row\nat List',
		);
	});

	test('formats diagnostics that fit one Discord message', () => {
		const info = {
			client: 'v1.0.0',
			commit: 'abc123',
			loader: '1.2.0',
			loaderOrigin: 'github',
			framework: '',
			discord: '352.0',
			discordChannel: 'Stable',
			discordBuild: '352000',
			appSource: 'Play Store',
			react: '19.0.0',
			reactNative: '0.79.0',
			hermes: '0.13.0',
			bytecode: '96',
			platform: 'Android',
			os: '15 (SDK 35)',
			device: 'Pixel 9',
			flags: ['Developer mode'],
		};
		const plugins = pluginsLine(
			[
				{ id: 'dev.a', version: '1.0.0', failed: false },
				{ id: 'dev.b', version: '2.1.0', failed: true },
			],
			false,
		);
		const short = crashDiagnostics(
			{ error: crash(), componentStack: '\n    in Row' },
			info,
			plugins,
		);
		const deep = crash();

		deep.stack = `TypeError: deep\n${'    at frame (bundle:1:2)\n'.repeat(500)}`;

		const long = crashDiagnostics({ error: deep }, info, plugins);

		expect(short).toContain('- **Unbound:** v1.0.0 (`abc123`)');
		expect(short).toContain('- **Plugins (2):** `dev.a@1.0.0`, `dev.b@2.1.0` (failed)');
		expect(pluginsLine([], false)).toBe('- **Plugins (0):** none');
		expect(pluginsLine([], true)).toBe('- **Plugins:** none, recovery mode');
		expect(short).toContain('**TypeError:** Cannot read property x of undefined');
		expect(short).toContain('Stack trace:\nTypeError');
		expect(short).toContain('at render\n');
		expect(short).toEndWith('Component stack:\nin Row\n```');
		expect(long.length).toBeLessThanOrEqual(2000);
		expect(long).toEndWith('at frame\n```');
	});

	test('pre-fills a bug report and keeps the URL bounded', () => {
		const url = bugReportURL(
			{ error: crash('x'.repeat(20_000)) },
			{ clientVersion: '1.0.0', platform: 'ios' },
		);
		const parsed = new URL(url);

		expect(url.startsWith(`${ISSUES_URL}?`)).toBe(true);
		expect(parsed.searchParams.get('title')).toHaveLength(120);
		expect(parsed.searchParams.get('template')).toBe('crash-report.yml');
		expect(parsed.searchParams.get('platform')).toBe('iOS');
		expect(parsed.searchParams.get('environment')).toContain('**Platform:** iOS');
		expect(parsed.searchParams.get('error')?.length).toBeLessThanOrEqual(6000);
	});
});
