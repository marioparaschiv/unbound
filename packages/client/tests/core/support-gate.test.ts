import { describe, expect, test } from 'bun:test';

import { accountCreatedAt, ANSWERS, needsSupportGate, shuffledAnswers } from '~/core/support-gate';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18);

function idCreatedAt(ms: number): string {
	return String((BigInt(ms) - 1420070400000n) << 22n);
}

const oldAccount = idCreatedAt(NOW - 3 * 365 * DAY);
const newAccount = idCreatedAt(NOW - 10 * DAY);

describe('accountCreatedAt', () => {
	test('reads the creation time from a snowflake', () => {
		expect(accountCreatedAt(oldAccount)).toBe(NOW - 3 * 365 * DAY);
	});
});

describe('needsSupportGate', () => {
	test('gates a new account', () => {
		expect(
			needsSupportGate({ userId: newAccount, roles: [], joinedAt: NOW - 200 * DAY }, NOW),
		).toBe(true);
	});

	test('gates an old account that joined recently', () => {
		expect(
			needsSupportGate({ userId: oldAccount, roles: [], joinedAt: NOW - 3 * DAY }, NOW),
		).toBe(true);
	});

	test('lets long-standing members through', () => {
		expect(
			needsSupportGate({ userId: oldAccount, roles: [], joinedAt: NOW - 120 * DAY }, NOW),
		).toBe(false);
	});

	test('lets trusted roles through however new they are', () => {
		expect(
			needsSupportGate(
				{ userId: newAccount, roles: ['997233808522874910'], joinedAt: NOW },
				NOW,
			),
		).toBe(false);
	});

	test('ignores roles that say nothing, such as platform roles', () => {
		expect(
			needsSupportGate(
				{ userId: newAccount, roles: ['952692951425904730'], joinedAt: NOW },
				NOW,
			),
		).toBe(true);
	});
});

describe('shuffledAnswers', () => {
	test('keeps every answer once', () => {
		expect(shuffledAnswers(() => 0.99).sort()).toEqual([...ANSWERS].sort());
		expect(shuffledAnswers(() => 0).sort()).toEqual([...ANSWERS].sort());
	});
});
