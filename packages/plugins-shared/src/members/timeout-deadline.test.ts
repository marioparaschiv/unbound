import { expect, test } from 'bun:test';

import { getTimeoutDeadline } from './timeout-deadline';

const now = Date.parse('2024-01-01T00:00:00.000Z');

test('returns the end of a timeout that is still running', () => {
	expect(getTimeoutDeadline('2024-01-01T01:00:00.000Z', now)).toBe(now + 3_600_000);
	expect(getTimeoutDeadline(new Date(now + 60_000), now)).toBe(now + 60_000);
});

test('returns null for an expired, missing or unparseable timeout', () => {
	expect(getTimeoutDeadline('2023-12-31T23:59:59.000Z', now)).toBeNull();
	expect(getTimeoutDeadline(null, now)).toBeNull();
	expect(getTimeoutDeadline('not a date', now)).toBeNull();
});
