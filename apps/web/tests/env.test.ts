import { describe, expect, test } from 'bun:test';

import { parseEnv } from '~/lib/env';

import { OFFLINE_DATABASE_ENV, TEST_ENV } from './helpers/context';

const valid = { ...TEST_ENV, ...OFFLINE_DATABASE_ENV };

describe('parseEnv', () => {
	test('parses a complete environment and applies defaults', () => {
		const env = parseEnv({ ...valid, AUTH_RATE_LIMIT_MAX: '20' });

		expect(env.PORT).toBe(3000);
		expect(env.AUTH_RATE_LIMIT_MAX).toBe(20);
		expect(env.IP_ADDRESS_HEADER).toBe('x-forwarded-for');
	});

	test('names a missing required variable', () => {
		const { DISCORD_CLIENT_SECRET, ...missing } = valid;

		expect(() => parseEnv(missing)).toThrow(/DISCORD_CLIENT_SECRET/);
	});

	test('names an invalid variable', () => {
		expect(() => parseEnv({ ...valid, PUBLIC_URL: 'not a url' })).toThrow(/PUBLIC_URL/);
		expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(
			/BETTER_AUTH_SECRET/,
		);
	});
});
