import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';
import { describe, expect, test } from 'bun:test';

import { loadConfig, loadDatabaseConfig } from '~/lib/config';

import { REQUIRED_ENV as ENV } from '../helpers/config';

describe('SPONSOR_PERK_GRACE_DAYS', () => {
	test("defaults to the web's grace period and takes an override", () => {
		const unset = loadConfig(ENV);
		const set = loadConfig({ ...ENV, SPONSOR_PERK_GRACE_DAYS: '3' });

		expect(unset.ok ? unset.config.env.SPONSOR_PERK_GRACE_DAYS : 'failed').toBe(
			DEFAULT_PERK_GRACE_DAYS,
		);
		expect(set.ok ? set.config.env.SPONSOR_PERK_GRACE_DAYS : 'failed').toBe(3);
	});
});

describe('loadConfig', () => {
	test('names every unset env var in one message', () => {
		const result = loadConfig({});

		expect(result.ok).toBe(false);

		if (result.ok) return;

		for (const name of Object.keys(ENV)) {
			expect(result.message).toContain(`env ${name} is not set`);
		}
	});

	test('names an invalid value', () => {
		const result = loadConfig({ ...ENV, RECONCILE_INTERVAL_SECONDS: '-1' });

		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.message).toContain('env RECONCILE_INTERVAL_SECONDS');
	});

	test('passes a complete env with the real constants, though some ids are still unset', () => {
		const result = loadConfig(ENV);

		expect(result).toEqual({
			ok: true,
			config: {
				guildId: '950850315601711176',
				ids: expect.objectContaining({
					PLUGINS_CHANNEL_ID: '1564067818415333407',
					RELEASES_ROLE_ID: undefined,
				}),
				siteUrl: 'https://unbound.rip',
				cdnUrl: 'https://cdn.unbound.rip',
				env: {
					...ENV,
					RECONCILE_INTERVAL_SECONDS: 300,
					SPONSOR_PERK_GRACE_DAYS: 7,
					GITHUB_TOKEN: undefined,
					OTEL_ENABLED: false,
					OTEL_ENDPOINT: undefined,
					OTEL_SERVICE_NAME: 'unbound-discord-bot',
					NODE_ENV: 'production',
					npm_package_version: 'unknown',
				},
			},
		});
	});

	test('names DATABASE_DIRECT_URL alone when only the pooled url is set', () => {
		const { DATABASE_DIRECT_URL: _, ...pooledOnly } = ENV;
		const result = loadConfig(pooledOnly);
		const problems = result.ok ? '' : result.message;

		expect(problems).toContain('env DATABASE_DIRECT_URL is not set');
		expect(problems.match(/^\s+- /gm)).toHaveLength(1);
	});

	test('treats an empty GITHUB_TOKEN as unset and keeps a set one', () => {
		const empty = loadConfig({ ...ENV, GITHUB_TOKEN: '' });
		const set = loadConfig({ ...ENV, GITHUB_TOKEN: 'token' });

		expect(empty.ok ? empty.config.env.GITHUB_TOKEN : 'failed').toBeUndefined();
		expect(set.ok ? set.config.env.GITHUB_TOKEN : 'failed').toBe('token');
	});

	test('reads the database slice without the Discord secrets, as migrations run', () => {
		const url = ENV.DATABASE_DIRECT_URL;

		expect(loadDatabaseConfig({ DATABASE_DIRECT_URL: url })).toEqual({
			ok: true,
			config: { DATABASE_DIRECT_URL: url },
		});
		expect(loadDatabaseConfig({ DISCORD_TOKEN: 'token' })).toEqual({
			ok: false,
			message: expect.stringContaining('env DATABASE_DIRECT_URL is not set'),
		});
	});

	test('reads the service version bun run sets', () => {
		const result = loadConfig({ ...ENV, npm_package_version: '1.2.3' });

		expect(result.ok ? result.config.env.npm_package_version : 'failed').toBe('1.2.3');
	});
});
