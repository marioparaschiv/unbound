import { describe, expect, test } from 'bun:test';

import { messageAgeDays } from '~/lib/age';

const DAY = 86_400_000;

function idSentAt(ms: number): string {
	return String((BigInt(ms) - 1_420_070_400_000n) << 22n);
}

describe('messageAgeDays', () => {
	const now = Date.UTC(2026, 10, 19);

	test('reads the age from the snowflake', () => {
		expect(messageAgeDays(idSentAt(now - 45 * DAY), now)).toBe(45);
		expect(messageAgeDays(idSentAt(now - 2 * 60 * 60 * 1000), now)).toBe(0);
	});

	test('ignores ids that are not snowflakes', () => {
		expect(messageAgeDays('local-1', now)).toBeUndefined();
	});
});
