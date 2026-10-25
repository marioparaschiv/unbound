import { describe, expect, test } from 'bun:test';

import { checkConfig } from '~/lib/config';
import { GUILD_ID } from '~/lib/constants';

const ENV = {
	DISCORD_TOKEN: 'token',
	DATABASE_URL: 'postgres://bot@localhost/bot',
	UNBOUND_API_URL: 'https://unbound.rip',
	UNBOUND_API_KEY: 'key',
};

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
		const result = checkConfig({ ...ENV, FEED_PAGE_SIZE: '501' }, GUILD_ID);

		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.message).toContain('env FEED_PAGE_SIZE');
	});

	test('passes a complete env with the real constants, though channel ids are still 0', () => {
		const result = checkConfig(ENV, GUILD_ID);

		expect(result).toEqual({
			ok: true,
			env: {
				...ENV,
				POLL_INTERVAL_SECONDS: 30,
				FEED_PAGE_SIZE: 100,
				RECONCILE_INTERVAL_SECONDS: 300,
				GITHUB_TOKEN: undefined,
			},
		});
	});

	test('treats an empty GITHUB_TOKEN as unset and keeps a set one', () => {
		const empty = checkConfig({ ...ENV, GITHUB_TOKEN: '' }, GUILD_ID);
		const set = checkConfig({ ...ENV, GITHUB_TOKEN: 'token' }, GUILD_ID);

		expect(empty.ok ? empty.env.GITHUB_TOKEN : 'failed').toBeUndefined();
		expect(set.ok ? set.env.GITHUB_TOKEN : 'failed').toBe('token');
	});
});
