import { readFileSync } from 'node:fs';

import { writeOutputs } from './pr-builds-plan';

export type PullRequestSummary = {
	number: number;
	state: string;
	head: { sha: string; repo: { full_name: string } | null };
	base: { repo: { full_name: string } };
};

export type ForkRun = {
	repository: string;
	headSha: string;
	headRepository: string;
	eventPullRequests: number[];
	claimed: string;
};

export type PullRequestFetcher = (number: number) => Promise<PullRequestSummary | undefined>;

/**
 * @description Finds the pull request a fork's build belongs to, trusting only what the API confirms for that exact head commit and repository.
 * @param run The workflow run's repository, head commit, head repository, linked pull requests and the number the build claimed.
 * @param fetchPullRequest Looks a pull request up through the API.
 * @returns The confirmed pull request number.
 */
export async function resolveForkPullRequest(
	run: ForkRun,
	fetchPullRequest: PullRequestFetcher,
): Promise<number> {
	const claimed = run.claimed.trim();
	const candidates = [...run.eventPullRequests];

	if (/^[1-9][0-9]*$/.test(claimed)) {
		candidates.push(Number(claimed));
	}

	if (!candidates.length) {
		throw new Error('The fork build names no pull request.');
	}

	for (const number of new Set(candidates)) {
		const pullRequest = await fetchPullRequest(number);

		if (
			pullRequest?.number === number &&
			pullRequest.state === 'open' &&
			pullRequest.head.sha === run.headSha &&
			pullRequest.head.repo?.full_name === run.headRepository &&
			pullRequest.base.repo.full_name === run.repository &&
			run.headRepository !== run.repository
		) {
			return number;
		}
	}

	throw new Error(
		`No open fork pull request into ${run.repository} has head ${run.headSha} from ${run.headRepository}; refusing to publish for ${candidates.join(', ')}.`,
	);
}

/**
 * @description Checks that a fork's client build declares the channel of its own pull request, so a signed manifest can never pass as another channel's.
 * @param manifestText The fork's `manifest.json`.
 * @param pullRequest The confirmed pull request number.
 * @returns Why the manifest is refused, or an empty string.
 */
export function forkManifestProblem(manifestText: string, pullRequest: number): string {
	let manifest: { channel?: string } | null;

	try {
		manifest = JSON.parse(manifestText) as { channel?: string } | null;
	} catch {
		return 'manifest.json is not JSON.';
	}

	const expected = `pr-${pullRequest}`;

	return manifest?.channel === expected
		? ''
		: `manifest.json declares channel ${String(manifest?.channel)}, not ${expected}.`;
}

/**
 * @description Builds a fetcher that reads pull requests from the GitHub REST API.
 * @param repository The `owner/name` the pull requests target.
 * @param token The workflow token.
 * @returns The fetcher.
 */
export function githubPullRequestFetcher(repository: string, token: string): PullRequestFetcher {
	return async (number) => {
		const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28',
			},
		});

		if (response.status === 404) {
			return;
		}

		if (!response.ok) {
			throw new Error(
				`The GitHub API answered ${response.status} for pull request ${number}.`,
			);
		}

		return (await response.json()) as PullRequestSummary;
	};
}

/**
 * @description Reads the pull request numbers GitHub linked to a workflow run.
 * @param json The run's `pull_requests` as JSON.
 * @returns The numbers.
 */
export function parseEventPullRequests(json: string | undefined): number[] {
	if (!json?.trim()) {
		return [];
	}

	const parsed = JSON.parse(json) as Array<{ number?: number } | null> | null;

	if (!Array.isArray(parsed)) {
		return [];
	}

	return parsed.flatMap((entry) => {
		const number = entry?.number;

		return typeof number === 'number' && Number.isSafeInteger(number) && number > 0
			? [number]
			: [];
	});
}

if (import.meta.main && process.argv[2] === 'check-manifest') {
	const problem = forkManifestProblem(
		readFileSync(process.env.MANIFEST_FILE ?? '', 'utf8'),
		Number(process.env.PR_NUMBER),
	);

	if (problem) {
		throw new Error(problem);
	}
} else if (import.meta.main) {
	const env = process.env;
	const repository = env.GITHUB_REPOSITORY ?? '';
	const claimed = env.CLAIMED_FILE ? readFileSync(env.CLAIMED_FILE, 'utf8').slice(0, 32) : '';
	const number = await resolveForkPullRequest(
		{
			repository,
			headSha: env.HEAD_SHA ?? '',
			headRepository: env.HEAD_REPOSITORY ?? '',
			eventPullRequests: parseEventPullRequests(env.EVENT_PULL_REQUESTS),
			claimed,
		},
		githubPullRequestFetcher(repository, env.GITHUB_TOKEN ?? ''),
	);

	writeOutputs(env.GITHUB_OUTPUT, { number: String(number) });
}
