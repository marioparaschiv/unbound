import { describe, expect, test } from 'bun:test';

import { formatName } from './format-name';

describe('formatName', () => {
	test('formats each mode', () => {
		const parts = { displayed: 'Alice', username: 'alice99' };

		expect(formatName({ ...parts, mode: 'nick-user' })).toBe('Alice (@alice99)');
		expect(formatName({ ...parts, mode: 'user-nick' })).toBe('@alice99 (Alice)');
		expect(formatName({ ...parts, mode: 'user' })).toBe('@alice99');
	});

	test('keeps the leading @ of a mention-style name', () => {
		expect(formatName({ displayed: '@Alice', username: 'alice99', mode: 'nick-user' })).toBe(
			'@Alice (@alice99)',
		);
	});

	test('prefers a friend nickname over the displayed name', () => {
		expect(
			formatName({
				displayed: 'Alice',
				username: 'alice99',
				nickname: 'Al',
				mode: 'nick-user',
			}),
		).toBe('Al (@alice99)');
	});

	test('leaves the name alone when it already is the username', () => {
		expect(formatName({ displayed: 'alice99', username: 'alice99', mode: 'user-nick' })).toBe(
			'alice99',
		);
	});
});
