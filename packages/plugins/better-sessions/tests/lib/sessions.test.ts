import { describe, expect, test } from 'bun:test';

import { defaultName, isNew, lastUsed, unseenSessions, type Session } from '~/lib/sessions';

const session = (id: string, time = '2026-11-13T02:05:00.000Z'): Session => ({
	id_hash: id,
	approx_last_used_time: time,
	client_info: { os: 'iOS', platform: 'Discord iOS', location: 'Hof, Bavaria, Germany' },
});

describe('sessions', () => {
	test('names a session by its system and client', () => {
		expect(defaultName(session('a'))).toBe('iOS · Discord iOS');
	});

	test('writes the last use to the minute, or nothing for a bad time', () => {
		expect(lastUsed(session('a'), 'en-GB', 'UTC')).toBe('13 Nov 2026, 02:05');
		expect(lastUsed(session('a', 'never'), 'en-GB', 'UTC')).toBe('');
	});

	test('marks a session new for a day after it is first seen', () => {
		const now = Date.UTC(2026, 10, 13);

		expect(isNew(undefined, now)).toBe(true);
		expect(isNew(now - 60_000, now)).toBe(true);
		expect(isNew(now - 2 * 24 * 60 * 60 * 1000, now)).toBe(false);
	});

	test('picks out the sessions not seen before', () => {
		expect(
			unseenSessions([session('a'), session('b')], { a: 1 }).map((s) => s.id_hash),
		).toEqual(['b']);
	});
});
