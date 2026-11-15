import { describe, expect, test } from 'bun:test';

import { expiryOf, inviteCodes } from '~/lib/invites';

describe('inviteCodes', () => {
	test('finds each invite code once, in order', () => {
		expect(
			inviteCodes(
				'join discord.gg/abc and https://discord.com/invite/x-Y1 or discord.gg/abc',
			),
		).toEqual(['abc', 'x-Y1']);
		expect(inviteCodes('no invites here')).toEqual([]);
	});
});

describe('expiryOf', () => {
	const now = Date.parse('2026-11-15T12:00:00Z');

	test('names the largest whole unit left', () => {
		expect(expiryOf('2026-11-18T13:00:00Z', now)).toEqual({ kind: 'days', count: 3 });
		expect(expiryOf('2026-11-15T17:30:00Z', now)).toEqual({ kind: 'hours', count: 5 });
		expect(expiryOf('2026-11-15T12:00:20Z', now)).toEqual({ kind: 'minutes', count: 1 });
	});

	test('handles never-expiring and expired invites', () => {
		expect(expiryOf(null, now)).toEqual({ kind: 'never' });
		expect(expiryOf('2026-11-15T11:00:00Z', now)).toEqual({ kind: 'expired' });
	});
});
