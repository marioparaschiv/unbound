import { describe, expect, test } from 'bun:test';

import type { ForkRun, PullRequestSummary } from './pr-builds-fork';

import {
	forkManifestProblem,
	parseEventPullRequests,
	resolveForkPullRequest,
} from './pr-builds-fork';

const run: ForkRun = {
	repository: 'marioparaschiv/unbound',
	headSha: 'a'.repeat(40),
	headRepository: 'someone/unbound',
	eventPullRequests: [],
	claimed: '42\n',
};

function pullRequest(
	number: number,
	changes: Partial<PullRequestSummary> = {},
): PullRequestSummary {
	return {
		number,
		state: 'open',
		head: { sha: run.headSha, repo: { full_name: run.headRepository } },
		base: { repo: { full_name: run.repository } },
		...changes,
	};
}

function fetcherFor(pullRequests: PullRequestSummary[]) {
	const requested: number[] = [];

	async function fetch(number: number) {
		requested.push(number);

		return pullRequests.find((entry) => entry.number === number);
	}

	return { fetch, requested };
}

describe('resolveForkPullRequest', () => {
	test('accepts the claimed number once the API confirms its head', async () => {
		const { fetch } = fetcherFor([pullRequest(42)]);

		expect(await resolveForkPullRequest(run, fetch)).toBe(42);
	});

	test('prefers the pull requests GitHub linked to the run', async () => {
		const { fetch, requested } = fetcherFor([pullRequest(7), pullRequest(42)]);

		expect(await resolveForkPullRequest({ ...run, eventPullRequests: [7] }, fetch)).toBe(7);
		expect(requested).toEqual([7]);
	});

	test("refuses a number whose head is another commit or another fork's", async () => {
		for (const other of [
			pullRequest(42, {
				head: { sha: 'b'.repeat(40), repo: { full_name: run.headRepository } },
			}),
			pullRequest(42, {
				head: { sha: run.headSha, repo: { full_name: 'attacker/unbound' } },
			}),
			pullRequest(42, { state: 'closed' }),
			pullRequest(42, { base: { repo: { full_name: 'someone/unbound' } } }),
		]) {
			const { fetch } = fetcherFor([other]);

			expect(
				String(await resolveForkPullRequest(run, fetch).catch((cause: unknown) => cause)),
			).toContain('refusing to publish');
		}
	});

	test('refuses runs from the repository itself and runs that name nothing', async () => {
		const { fetch } = fetcherFor([pullRequest(42)]);
		const sameRepository = await resolveForkPullRequest(
			{ ...run, headRepository: run.repository },
			fetch,
		).catch((cause: unknown) => cause);
		const unnamed = await resolveForkPullRequest(
			{ ...run, claimed: 'not a number' },
			fetch,
		).catch((cause: unknown) => cause);

		expect(String(sameRepository)).toContain('refusing to publish');
		expect(String(unnamed)).toContain('names no pull request');
	});
});

describe('parseEventPullRequests', () => {
	test('keeps only positive integer numbers', () => {
		expect(
			parseEventPullRequests('[{"number":7},{"number":"8"},{"id":1},{"number":-1}]'),
		).toEqual([7]);
		expect(parseEventPullRequests('')).toEqual([]);
		expect(parseEventPullRequests('{}')).toEqual([]);
	});
});

describe('forkManifestProblem', () => {
	test('accepts only the channel of the confirmed pull request', () => {
		expect(forkManifestProblem('{"channel":"pr-42"}', 42)).toBe('');
		expect(forkManifestProblem('{"channel":"beta"}', 42)).toMatch(/beta/);
		expect(forkManifestProblem('{"channel":"pr-7"}', 42)).toMatch(/pr-7/);
		expect(forkManifestProblem('{}', 42)).toMatch(/channel/);
		expect(forkManifestProblem('not json', 42)).not.toBe('');
	});
});
