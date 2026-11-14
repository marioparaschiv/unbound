import { describe, expect, test } from 'bun:test';

import { formatLogLine } from '~/lib/format-log';

describe('formatLogLine', () => {
	test('cleans a console line from a loader that sends no source', () => {
		expect(formatLogLine({ type: 'log', level: 1, message: "'a', 'b'" })).toBe('a b');
	});

	test('puts the source and scope before the message', () => {
		expect(
			formatLogLine({
				type: 'log',
				level: 2,
				message: 'Theme updated.',
				source: 'unbound',
				scope: ['Loader', 'themes'],
				at: 1,
			}),
		).toBe('unbound [Loader → themes] Theme updated.');
	});

	test('leaves a non-console message as written', () => {
		expect(
			formatLogLine({
				type: 'log',
				level: 1,
				message: "'a', 'b'",
				source: 'native',
				scope: [],
			}),
		).toBe("native 'a', 'b'");
	});

	test('cleans a JS console line', () => {
		expect(
			formatLogLine({ type: 'log', level: 1, message: "'a', 'b'", source: 'js', scope: [] }),
		).toBe('js a b');
	});
});
