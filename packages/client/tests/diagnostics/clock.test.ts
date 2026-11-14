import { describe, expect, test } from 'bun:test';

import { clockSkew, utcOffset } from '~/diagnostics/clock';

describe('utcOffset', () => {
	test('formats the offset with a sign and minutes', () => {
		const date = new Date();
		const minutes = -date.getTimezoneOffset();

		expect(utcOffset(date)).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
		expect(utcOffset(date).charAt(3)).toBe(minutes < 0 ? '-' : '+');
	});
});

describe('clockSkew', () => {
	test('measures from the middle of the request against the header', () => {
		const server = Date.parse('Sat, 14 Nov 2026 12:00:00 GMT');

		expect(clockSkew(server + 240_000, server + 241_000, 'Sat, 14 Nov 2026 12:00:00 GMT')).toBe(
			240,
		);
		expect(
			clockSkew(server - 3_600_000, server - 3_599_000, 'Sat, 14 Nov 2026 12:00:00 GMT'),
		).toBe(-3600);
	});

	test('leaves out a missing or unreadable header', () => {
		expect(clockSkew(0, 1, null)).toBeUndefined();
		expect(clockSkew(0, 1, 'soon')).toBeUndefined();
	});
});
