import type { Fetch } from '~/lib/github-contributors';

export type RepoItem = { full_name: string; fork: boolean };
export type ContributorItem = { id: number };

export type FailResponse = {
	status: number;
	headers?: Record<string, string>;
	/** Only URLs containing this fail; every URL when unset. */
	match?: string;
};

export type FakeGitHubOptions = {
	/** Pages of `GET /orgs/unbound-app/repos`. */
	repos: RepoItem[][];
	/** Pages of each repo's contributors, by `owner/name`; 204 answers No Content. */
	contributors: Record<string, ContributorItem[][] | 204>;
};

export type GitHubCall = { url: string; authorization: string | null };

export type FakeGitHub = {
	fetch: Fetch;
	calls: GitHubCall[];
	/** Makes matching requests fail until cleared with undefined. */
	fail: (response: FailResponse | undefined) => void;
};

const CONTRIBUTORS_PATH = /^\/repos\/([^/]+\/[^/]+)\/contributors$/;

function page<T>(url: URL, pages: T[][]): Response {
	const index = Number(url.searchParams.get('page') ?? '1') - 1;
	const headers = new Headers();

	if (index + 1 < pages.length) {
		const next = new URL(url);

		next.searchParams.set('page', String(index + 2));
		headers.set('link', `<${next.toString()}>; rel="next", <${url.toString()}>; rel="first"`);
	}

	return Response.json(pages[index] ?? [], { headers });
}

/**
 * @description A GitHub REST API serving repo and contributor pages linked by `Link` headers.
 * @param options The repo pages and each repo's contributor pages.
 * @returns The fetch, the calls it received and `fail()`.
 */
export function fakeGitHub(options: FakeGitHubOptions): FakeGitHub {
	const calls: GitHubCall[] = [];
	let failure: FailResponse | undefined;

	async function fetch(url: string, init: RequestInit) {
		const parsed = new URL(url);

		calls.push({ url, authorization: new Headers(init.headers).get('authorization') });

		if (failure && (!failure.match || url.includes(failure.match))) {
			return new Response('{}', { status: failure.status, headers: failure.headers });
		}

		if (parsed.pathname === '/orgs/unbound-app/repos') {
			return page(parsed, options.repos);
		}

		const repo = CONTRIBUTORS_PATH.exec(parsed.pathname)?.[1];
		const pages = repo ? options.contributors[repo] : undefined;

		if (pages === 204) {
			return new Response(null, { status: 204 });
		}

		if (!pages) {
			return new Response('{}', { status: 404 });
		}

		return page(parsed, pages);
	}

	return {
		fetch,
		calls,
		fail(response) {
			failure = response;
		},
	};
}
