import { describe, expect, test } from 'bun:test';

import { bugReportURL, describeError, ISSUES_URL } from './error-fallback';

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

	test('pre-fills a bug report and keeps the URL bounded', () => {
		const url = bugReportURL(
			{ error: crash('x'.repeat(20_000)) },
			{ clientVersion: '1.0.0', platform: 'ios' },
		);
		const parsed = new URL(url);

		expect(url.startsWith(`${ISSUES_URL}?`)).toBe(true);
		expect(parsed.searchParams.get('title')).toHaveLength(120);
		expect(parsed.searchParams.get('body')).toContain('**Platform:** ios');
		expect(parsed.searchParams.get('body')?.length).toBeLessThan(6400);
	});
});
