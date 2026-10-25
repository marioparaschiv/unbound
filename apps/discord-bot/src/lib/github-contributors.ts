import { createLogger } from '@unbound-app/logger';
import { z } from 'zod';

import { envSchema } from '~/lib/env';

const logger = createLogger('Bot', 'Contributors');

/** Narrower than `typeof fetch`, which Bun extends with `preconnect`; `globalThis.fetch` is assignable. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type ContributorCache = {
	/** The fresh set, the stale set after a failed refresh, or undefined before any success; never throws. */
	get: () => Promise<ReadonlySet<string> | undefined>;
};

export type ContributorCacheOptions = {
	fetch?: Fetch;
	token?: string;
	refreshMs?: number;
	now?: () => number;
};

export const GITHUB_API = 'https://api.github.com';
export const ORG = 'unbound-app';
export const EXTRA_REPOS = ['marioparaschiv/unbound'];
export const CONTRIBUTOR_REFRESH_MS = 6 * 60 * 60 * 1000;
export const FAILED_REFRESH_RETRY_MS = 15 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 30_000;

const repoSchema = z.object({ full_name: z.string(), fork: z.boolean() });
const contributorSchema = z.object({ id: z.number() });
const NEXT_LINK = /<([^>]+)>;\s*rel="next"/;

export class GitHubError extends Error {
	constructor(
		readonly url: string,
		readonly status: number,
		/** Epoch ms GitHub asked us to wait until, from `retry-after` or an exhausted `x-ratelimit-reset`. */
		readonly retryAt: number | undefined,
	) {
		super(`GitHub responded ${status} for ${url}.`);
	}
}

// `retry-after` may also be an HTTP-date; anything but a finite number of seconds is ignored.
function secondsOf(header: string | null): number | undefined {
	if (!header) {
		return undefined;
	}

	const seconds = Number(header);

	return Number.isFinite(seconds) ? seconds : undefined;
}

function retryAtOf(response: Response, now: () => number): number | undefined {
	const retryAfter = secondsOf(response.headers.get('retry-after'));

	if (retryAfter !== undefined) {
		return now() + retryAfter * 1000;
	}

	const reset = secondsOf(response.headers.get('x-ratelimit-reset'));

	if (reset !== undefined && response.headers.get('x-ratelimit-remaining') === '0') {
		return reset * 1000;
	}

	return undefined;
}

async function paginate<T>(
	url: string,
	schema: z.ZodType<T>,
	request: (url: string) => Promise<Response>,
	now: () => number,
): Promise<T[]> {
	const items: T[] = [];
	let next: string | undefined = url;

	while (next) {
		const response = await request(next);

		if (!response.ok) {
			throw new GitHubError(next, response.status, retryAtOf(response, now));
		}

		if (response.status === 204) {
			return items;
		}

		items.push(...z.array(schema).parse(await response.json()));
		next = NEXT_LINK.exec(response.headers.get('link') ?? '')?.[1];
	}

	return items;
}

/**
 * @description Fetches every contributor's GitHub id across unbound-app's public non-fork repos and EXTRA_REPOS.
 * @param fetch The fetch to call.
 * @param token Optional GitHub token, sent as a Bearer header.
 * @param now The clock that turns `retry-after` into an epoch.
 * @returns Numeric GitHub ids as strings; rejects with GitHubError on any failed page.
 */
export async function fetchContributorIds(
	fetch: Fetch,
	token?: string,
	now: () => number = Date.now,
): Promise<Set<string>> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'unbound-discord-bot',
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	function request(url: string) {
		return fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
	}

	const repos = await paginate(
		`${GITHUB_API}/orgs/${ORG}/repos?type=public&per_page=100`,
		repoSchema,
		request,
		now,
	);
	const names = new Set([
		...repos.filter((repo) => !repo.fork).map((repo) => repo.full_name),
		...EXTRA_REPOS,
	]);
	const pages = await Promise.all(
		[...names].map((name) =>
			paginate(
				`${GITHUB_API}/repos/${name}/contributors?per_page=100`,
				contributorSchema,
				request,
				now,
			),
		),
	);

	return new Set(pages.flat().map((contributor) => String(contributor.id)));
}

/**
 * @description Creates an in-memory contributor-id cache that refreshes every `refreshMs` and keeps the stale set on failure.
 * @param options Fetch, token (default `GITHUB_TOKEN`), refresh interval and clock.
 * @returns The cache; concurrent `get()` calls share one refresh.
 */
export function createContributorCache(options: ContributorCacheOptions = {}): ContributorCache {
	const {
		fetch = globalThis.fetch,
		token = envSchema.shape.GITHUB_TOKEN.parse(process.env.GITHUB_TOKEN),
		refreshMs = CONTRIBUTOR_REFRESH_MS,
		now = Date.now,
	} = options;
	let ids: ReadonlySet<string> | undefined;
	let nextAt = 0;
	let inFlight: Promise<void> | undefined;

	// All or nothing: a failed page keeps the previous set whole rather than a partial one.
	async function refresh() {
		try {
			ids = await fetchContributorIds(fetch, token, now);
			nextAt = now() + refreshMs;
			logger.info(`Loaded ${ids.size} contributors.`);
		} catch (error) {
			const retryAt = error instanceof GitHubError ? error.retryAt : undefined;

			nextAt = Math.max(now() + FAILED_REFRESH_RETRY_MS, retryAt ?? 0);

			const until = new Date(nextAt).toISOString();

			logger.warn(
				ids
					? `Failed to refresh contributors; keeping ${ids.size} cached, next try at ${until}:`
					: `Failed to load contributors; Contributor is not granted until a refresh succeeds, next try at ${until}:`,
				error,
			);
		}
	}

	return {
		async get() {
			if (now() >= nextAt) {
				inFlight ??= refresh().finally(() => {
					inFlight = undefined;
				});
				await inFlight;
			}

			return ids;
		},
	};
}

export default {
	GITHUB_API,
	ORG,
	EXTRA_REPOS,
	CONTRIBUTOR_REFRESH_MS,
	FAILED_REFRESH_RETRY_MS,
	REQUEST_TIMEOUT_MS,
	GitHubError,
	fetchContributorIds,
	createContributorCache,
};
