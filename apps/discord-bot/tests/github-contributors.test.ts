import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';

import {
	createContributorCache,
	FAILED_REFRESH_RETRY_MS,
	fetchContributorIds,
} from '~/lib/github-contributors';

import { fakeGitHub, type FakeGitHubOptions } from './helpers/github-fetch';

const HOUR = 60 * 60 * 1000;

const GITHUB: FakeGitHubOptions = {
	repos: [
		[
			{ full_name: 'unbound-app/client', fork: false },
			{ full_name: 'unbound-app/forked', fork: true },
		],
		[{ full_name: 'unbound-app/empty', fork: false }],
	],
	contributors: {
		'unbound-app/client': [[{ id: 1 }, { id: 2 }], [{ id: 3 }]],
		'unbound-app/forked': [[{ id: 99 }]],
		'unbound-app/empty': 204,
		'marioparaschiv/unbound': [[{ id: 2 }, { id: 4 }]],
	},
};

function logged(spy: ReturnType<typeof spyOn>) {
	return spy.mock.calls.flat().map(String).join('\n');
}

describe('fetchContributorIds', () => {
	test('collects ids across Link-paginated org repos, skips forks, includes the extra repo, treats 204 as empty', async () => {
		const github = fakeGitHub(GITHUB);

		expect(await fetchContributorIds(github.fetch)).toEqual(new Set(['1', '2', '3', '4']));
		expect(github.calls.some((call) => call.url.includes('unbound-app/forked'))).toBe(false);
		expect(github.calls.map((call) => new URL(call.url).pathname)).toContain(
			'/repos/unbound-app/empty/contributors',
		);
	});

	test('sends Authorization only when a token is set', async () => {
		const anonymous = fakeGitHub(GITHUB);
		const authed = fakeGitHub(GITHUB);

		await fetchContributorIds(anonymous.fetch);
		await fetchContributorIds(authed.fetch, 'secret');

		expect(new Set(anonymous.calls.map((call) => call.authorization))).toEqual(new Set([null]));
		expect(new Set(authed.calls.map((call) => call.authorization))).toEqual(
			new Set(['Bearer secret']),
		);
	});

	test('every request carries an abort signal, so a hung request cannot stall the refresh', async () => {
		const github = fakeGitHub(GITHUB);

		await fetchContributorIds(github.fetch);

		expect(github.calls.length).toBeGreaterThan(0);
		expect(github.calls.every((call) => call.signal instanceof AbortSignal)).toBe(true);
	});

	test('rejects when any page fails', async () => {
		const github = fakeGitHub(GITHUB);

		github.fail({ status: 500, match: 'marioparaschiv' });

		const outcome = await fetchContributorIds(github.fetch).then(() => 'resolved', String);

		expect(outcome).toContain('GitHub responded 500');
	});
});

describe('createContributorCache', () => {
	const warn = spyOn(console, 'warn').mockImplementation(() => undefined);
	const info = spyOn(console, 'info').mockImplementation(() => void 0);
	let clock = 0;

	function now() {
		return clock;
	}

	afterEach(() => {
		warn.mockClear();
		clock = 0;
	});

	afterAll(() => {
		warn.mockRestore();
		info.mockRestore();
	});

	test('serves the cached set until refreshMs elapses, then refetches', async () => {
		const github = fakeGitHub(GITHUB);
		const cache = createContributorCache({ fetch: github.fetch, refreshMs: HOUR, now });

		expect(await cache.get()).toEqual(new Set(['1', '2', '3', '4']));

		const requests = github.calls.length;

		clock = HOUR - 1;
		await cache.get();
		expect(github.calls).toHaveLength(requests);

		clock = HOUR;
		await cache.get();
		expect(github.calls).toHaveLength(requests * 2);
	});

	test('concurrent gets share one refresh', async () => {
		const reference = fakeGitHub(GITHUB);
		const github = fakeGitHub(GITHUB);
		const cache = createContributorCache({ fetch: github.fetch, now });

		await fetchContributorIds(reference.fetch);
		await Promise.all([cache.get(), cache.get(), cache.get()]);

		expect(github.calls).toHaveLength(reference.calls.length);
	});

	test('a 403 rate-limited refresh keeps the stale set, warns, and waits for x-ratelimit-reset', async () => {
		const github = fakeGitHub(GITHUB);
		const cache = createContributorCache({ fetch: github.fetch, refreshMs: HOUR, now });
		const reset = 3 * HOUR;

		await cache.get();
		github.fail({
			status: 403,
			headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset / 1000) },
		});
		clock = HOUR;

		expect(await cache.get()).toEqual(new Set(['1', '2', '3', '4']));
		expect(logged(warn)).toContain('keeping 4 cached');

		const requests = github.calls.length;

		github.fail(undefined);
		clock = reset - 1;
		await cache.get();
		expect(github.calls).toHaveLength(requests);

		clock = reset;
		await cache.get();
		expect(github.calls.length).toBeGreaterThan(requests);
	});

	test('waits at least 15 minutes after a failure even when GitHub resets sooner', async () => {
		const github = fakeGitHub(GITHUB);
		const cache = createContributorCache({ fetch: github.fetch, now });

		github.fail({ status: 429, headers: { 'retry-after': '1' } });
		expect(await cache.get()).toBeUndefined();
		expect(logged(warn)).toContain('Contributor is not granted until a refresh succeeds');

		const requests = github.calls.length;

		github.fail(undefined);
		clock = FAILED_REFRESH_RETRY_MS - 1;
		expect(await cache.get()).toBeUndefined();
		expect(github.calls).toHaveLength(requests);

		clock = FAILED_REFRESH_RETRY_MS;
		expect(await cache.get()).toEqual(new Set(['1', '2', '3', '4']));
	});

	test('an HTTP-date retry-after falls back to the 15 minute retry and get() resolves', async () => {
		const github = fakeGitHub(GITHUB);
		const cache = createContributorCache({ fetch: github.fetch, now });

		github.fail({ status: 429, headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT' } });
		expect(await cache.get()).toBeUndefined();

		github.fail(undefined);
		clock = FAILED_REFRESH_RETRY_MS;
		expect(await cache.get()).toEqual(new Set(['1', '2', '3', '4']));
	});

	test('a refresh where one repo fails keeps the whole previous set', async () => {
		const contributors = { ...GITHUB.contributors };
		const github = fakeGitHub({ ...GITHUB, contributors });
		const cache = createContributorCache({ fetch: github.fetch, refreshMs: HOUR, now });

		await cache.get();
		contributors['unbound-app/client'] = [[{ id: 5 }]];
		github.fail({ status: 502, match: 'marioparaschiv' });
		clock = HOUR;

		expect(await cache.get()).toEqual(new Set(['1', '2', '3', '4']));
	});
});
