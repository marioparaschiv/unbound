import { describe, expect, test } from 'bun:test';

import { checkConfig } from '~/lib/config';

const ENV = {
	DISCORD_TOKEN: 'token',
	DATABASE_URL: 'postgres://bot@localhost/bot',
	UNBOUND_API_URL: 'https://unbound.rip',
	UNBOUND_API_KEY: 'key',
};
const UNSET_IDS = { RELEASES_CHANNEL_ID: '0', SPONSOR_ROLE_ID: '0' };
const SET_IDS = { RELEASES_CHANNEL_ID: '1', SPONSOR_ROLE_ID: '2' };

describe('checkConfig', () => {
	test('names every unset env var and every id constant still 0, in one message', () => {
		const result = checkConfig({}, UNSET_IDS);

		expect(result.ok).toBe(false);

		if (result.ok) return;

		for (const name of Object.keys(ENV)) {
			expect(result.message).toContain(`env ${name} is not set`);
		}

		for (const name of Object.keys(UNSET_IDS)) {
			expect(result.message).toContain(`constant ${name} in src/lib/constants.ts`);
		}
	});

	test('names an invalid value', () => {
		const result = checkConfig({ ...ENV, FEED_PAGE_SIZE: '501' }, SET_IDS);

		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.message).toContain('env FEED_PAGE_SIZE');
	});

	test('passes a complete config and applies defaults', () => {
		const result = checkConfig(ENV, SET_IDS);

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
		const empty = checkConfig({ ...ENV, GITHUB_TOKEN: '' }, SET_IDS);
		const set = checkConfig({ ...ENV, GITHUB_TOKEN: 'token' }, SET_IDS);

		expect(empty.ok ? empty.env.GITHUB_TOKEN : 'failed').toBeUndefined();
		expect(set.ok ? set.env.GITHUB_TOKEN : 'failed').toBe('token');
	});
});
