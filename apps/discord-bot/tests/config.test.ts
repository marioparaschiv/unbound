import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';
import { describe, expect, test } from 'bun:test';

import { parseDatabaseEnv } from '~/lib/env';
import { checkConfig } from '~/lib/config';
import { GUILD_ID } from '~/lib/constants';

const ENV = {
	DISCORD_TOKEN: 'token',
	DATABASE_URL: 'postgres://bot@localhost:6432/bot',
	DATABASE_DIRECT_URL: 'postgres://bot@localhost:5432/bot',
};

describe('SPONSOR_PERK_GRACE_DAYS', () => {
	test("defaults to the web's grace period and takes an override", () => {
		const unset = checkConfig(ENV, GUILD_ID);
		const set = checkConfig({ ...ENV, SPONSOR_PERK_GRACE_DAYS: '3' }, GUILD_ID);

		expect(unset.ok ? unset.env.SPONSOR_PERK_GRACE_DAYS : 'failed').toBe(
			DEFAULT_PERK_GRACE_DAYS,
		);
		expect(set.ok ? set.env.SPONSOR_PERK_GRACE_DAYS : 'failed').toBe(3);
	});
});

describe('checkConfig', () => {
	test('names every unset env var and an unset GUILD_ID, in one message', () => {
		const result = checkConfig({}, '0');

		expect(result.ok).toBe(false);

		if (result.ok) return;

		for (const name of Object.keys(ENV)) {
			expect(result.message).toContain(`env ${name} is not set`);
		}

		expect(result.message).toContain('constant GUILD_ID in src/lib/constants.ts is not set');
	});

	test('fails on an unset GUILD_ID alone', () => {
		const result = checkConfig(ENV, '0');

		expect(result.ok ? '' : result.message).toContain('constant GUILD_ID');
	});

	test('names an invalid value', () => {
		const result = checkConfig({ ...ENV, RECONCILE_INTERVAL_SECONDS: '-1' }, GUILD_ID);

		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.message).toContain('env RECONCILE_INTERVAL_SECONDS');
	});

	test('passes a complete env with the real constants, though channel ids are still 0', () => {
		const result = checkConfig(ENV, GUILD_ID);

		expect(result).toEqual({
			ok: true,
			env: {
				...ENV,
				RECONCILE_INTERVAL_SECONDS: 300,
				SPONSOR_PERK_GRACE_DAYS: 7,
				GITHUB_TOKEN: undefined,
				OTEL_ENABLED: false,
				OTEL_ENDPOINT: undefined,
				OTEL_SERVICE_NAME: 'unbound-discord-bot',
				NODE_ENV: 'production',
			},
		});
	});

	test('names DATABASE_DIRECT_URL alone when only the pooled url is set', () => {
		const { DATABASE_DIRECT_URL: _, ...pooledOnly } = ENV;
		const result = checkConfig(pooledOnly, GUILD_ID);

		expect(result.ok ? '' : result.message).toBe(
			'Refusing to start, the configuration is incomplete:\n  - env DATABASE_DIRECT_URL is not set',
		);
	});

	test('migrations read the direct url and refuse the pooled one alone', () => {
		expect(parseDatabaseEnv(ENV)).toEqual({ DATABASE_DIRECT_URL: ENV.DATABASE_DIRECT_URL });
		expect(() => parseDatabaseEnv({ DATABASE_URL: ENV.DATABASE_URL })).toThrow(
			'DATABASE_DIRECT_URL',
		);
	});

	test('treats an empty GITHUB_TOKEN as unset and keeps a set one', () => {
		const empty = checkConfig({ ...ENV, GITHUB_TOKEN: '' }, GUILD_ID);
		const set = checkConfig({ ...ENV, GITHUB_TOKEN: 'token' }, GUILD_ID);

		expect(empty.ok ? empty.env.GITHUB_TOKEN : 'failed').toBeUndefined();
		expect(set.ok ? set.env.GITHUB_TOKEN : 'failed').toBe('token');
	});
});
