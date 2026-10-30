import type {
	PushableRepository,
	RepositoryContributor,
	RepositoryRelease,
} from '@unbound-app/contracts/source';
import { commitShaSchema } from '@unbound-app/contracts/source';
import { APIError } from 'better-auth/api';
import { z } from 'zod';

import { consumeRateLimit } from '~/lib/rate-limit';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** What `GET /repos/{r}` says about a public repository the token can see. */
export type GitHubRepository = {
	id: number;
	/** `owner/name` as GitHub spells it, which may differ in case from what was asked. */
	repository: string;
	htmlUrl: string;
	description: string | null;
	homepage: string | null;
	topics: string[];
	license: string | null;
	stars: number;
	defaultBranch: string;
	canPush: boolean;
};

/** A file at a commit: its git blob id and size in bytes. */
export type TreeEntry = {
	sha: string;
	size: number;
};

/** Every regular file at a commit, keyed by `/`-separated path. Symlinks and submodules are left out. */
export type GitTree = Map<string, TreeEntry>;

export type RepositoryExtras = {
	contributors: RepositoryContributor[];
	latestRelease: RepositoryRelease | null;
};

export type GitHubClient = ReturnType<typeof createGitHubClient>;

const repositoryResponseSchema = z.object({
	id: z.number().int().positive(),
	full_name: z.string(),
	private: z.boolean(),
	html_url: z.url(),
	description: z.string().nullable(),
	homepage: z.string().nullish(),
	topics: z.array(z.string()).optional(),
	license: z.object({ spdx_id: z.string().nullable() }).nullish(),
	stargazers_count: z.number().int().nonnegative(),
	default_branch: z.string().min(1),
	permissions: z.object({ push: z.boolean() }).optional(),
});

const gitObjectSchema = z.object({
	sha: z.string(),
	type: z.string(),
});

const refResponseSchema = z.object({ object: gitObjectSchema });

const compareResponseSchema = z.object({ status: z.string() });

const treeResponseSchema = z.object({
	truncated: z.boolean(),
	tree: z.array(
		z.object({
			path: z.string(),
			mode: z.string(),
			type: z.string(),
			sha: z.string(),
			size: z.number().int().nonnegative().optional(),
		}),
	),
});

const blobResponseSchema = z.object({
	encoding: z.literal('base64'),
	content: z.string(),
});

const contributorsResponseSchema = z.array(
	z.object({ login: z.string().min(1), contributions: z.number().int().nonnegative() }),
);

const releaseResponseSchema = z.object({
	tag_name: z.string().min(1),
	name: z.string().nullable(),
	published_at: z.iso.datetime().nullable(),
	html_url: z.url(),
});

const userRepositoriesResponseSchema = z.array(
	z.object({
		full_name: z.string(),
		private: z.boolean(),
		description: z.string().nullable(),
		pushed_at: z.iso.datetime().nullable(),
		permissions: z.object({ push: z.boolean() }).optional(),
	}),
);

const MAX_CONTRIBUTORS = 10;
const MAX_TAGS = 20;
const MAX_TAG_DEPTH = 5;
const SYMLINK_MODE = '120000';

/** The only origin the OAuth app's credentials are ever sent to. */
const GITHUB_API_ORIGIN = 'https://api.github.com';

function linkExpired(): ApiError {
	return new ApiError('github_not_linked', 'Your GitHub link has expired. Link GitHub again.');
}

function unavailable(reason: string): ApiError {
	return new ApiError(
		'github_unavailable',
		`GitHub did not answer (${reason}). Try again in a few minutes.`,
	);
}

/**
 * @description Picks the `authorization` header for a GitHub API request: the user's token when there
 * is one, otherwise the OAuth app's client credentials, which lift public reads from 60 to 5,000
 * requests an hour. The app credentials only ever go to `https://api.github.com`.
 * @param env The validated environment.
 * @param token The user's GitHub token, or `null` to read public data.
 * @param url The request URL.
 * @returns The header value, or `undefined` to send the request anonymously.
 */
export function getGitHubAuthorization(
	env: Env,
	token: string | null,
	url: URL,
): string | undefined {
	if (token) {
		return `Bearer ${token}`;
	}

	if (url.origin !== GITHUB_API_ORIGIN) return;

	return `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`;
}

async function send(env: Env, token: string | null, path: string): Promise<Response> {
	const url = new URL(path, env.GITHUB_API_URL);
	const headers = new Headers({
		accept: 'application/vnd.github+json',
		'x-github-api-version': '2022-11-28',
	});
	const authorization = getGitHubAuthorization(env, token, url);

	if (authorization) {
		headers.set('authorization', authorization);
	}

	let response: Response;

	try {
		response = await fetch(url, { headers });
	} catch {
		throw unavailable('network error');
	}

	if (response.status === 401) {
		throw linkExpired();
	}

	if (response.ok || response.status === 404) {
		return response;
	}

	const limited =
		response.status === 429 ||
		(response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');

	throw unavailable(limited ? 'rate limited' : `status ${response.status}`);
}

// `null` when GitHub has nothing there: a 404, or the 204 an empty repository's lists answer with.
async function getJson<TSchema extends z.ZodType>(
	env: Env,
	token: string | null,
	path: string,
	schema: TSchema,
): Promise<z.output<TSchema> | null> {
	const response = await send(env, token, path);

	if (response.status === 404 || response.status === 204) {
		return null;
	}

	const parsed = schema.safeParse(await response.json().catch(() => null));

	if (!parsed.success) {
		throw unavailable(`unexpected response from ${new URL(path, env.GITHUB_API_URL).pathname}`);
	}

	return parsed.data;
}

function encodeRef(ref: string): string {
	return ref.split('/').map(encodeURIComponent).join('/');
}

function toHttpUrl(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const url = URL.parse(value);

	return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
}

function refNotFound(repository: string, ref: string): ApiError {
	return new ApiError(
		'ref_not_found',
		`${repository} has no branch, tag or commit ${ref}. Push it first.`,
	);
}

/**
 * @description Computes the id git gives a file's contents: `sha1("blob <length>\0" + bytes)`.
 * @param bytes The file's contents.
 * @returns The blob id as lowercase hex.
 */
export function gitBlobSha(bytes: Uint8Array): string {
	return new Bun.CryptoHasher('sha1')
		.update(`blob ${bytes.length}\0`)
		.update(bytes)
		.digest('hex');
}

/**
 * @description Binds GitHub's REST calls to one user's token. Every response is parsed here; callers
 * see domain types. A 401 is `github_not_linked`; rate limits, 5xx and network errors are `github_unavailable`.
 * @param env The validated environment; `GITHUB_API_URL` points tests at a fake.
 * @param token The user's GitHub OAuth access token, or `null` to read public data as the OAuth app.
 * @returns The calls publishing from GitHub needs.
 */
export function createGitHubClient(env: Env, token: string | null) {
	function get<TSchema extends z.ZodType>(path: string, schema: TSchema) {
		return getJson(env, token, path, schema);
	}

	async function peel(repository: string, ref: string, object: z.output<typeof gitObjectSchema>) {
		let current = object;

		for (let depth = 0; depth < MAX_TAG_DEPTH && current.type === 'tag'; depth++) {
			const tag = await get(
				`/repos/${repository}/git/tags/${current.sha}`,
				refResponseSchema,
			);

			if (!tag) {
				throw refNotFound(repository, ref);
			}

			current = tag.object;
		}

		if (current.type !== 'commit') {
			throw refNotFound(repository, ref);
		}

		return current.sha;
	}

	return {
		/**
		 * @description Reads a repository; a private or missing one is `repository_not_found`.
		 * @param repository The repository as `owner/name`.
		 * @returns The repository.
		 */
		async getRepository(repository: string): Promise<GitHubRepository> {
			const found = await get(`/repos/${repository}`, repositoryResponseSchema);

			if (!found || found.private) {
				throw new ApiError(
					'repository_not_found',
					`GitHub shows no repository ${repository} to your linked account. Only public repositories can be published.`,
				);
			}

			return {
				id: found.id,
				repository: found.full_name,
				htmlUrl: found.html_url,
				description: found.description || null,
				homepage: toHttpUrl(found.homepage),
				topics: (found.topics ?? []).slice(0, MAX_TAGS),
				license:
					found.license?.spdx_id && found.license.spdx_id !== 'NOASSERTION'
						? found.license.spdx_id
						: null,
				stars: found.stargazers_count,
				defaultBranch: found.default_branch,
				canPush: found.permissions?.push ?? false,
			};
		},

		/**
		 * @description Resolves a branch or tag through the repository's own refs, peeling annotated
		 * tags. A raw SHA counts only when it is reachable from the default branch, since GitHub also
		 * serves commits that exist only in forks.
		 * @param repository The repository as `owner/name`.
		 * @param ref A branch, tag or full commit SHA.
		 * @param defaultBranch The repository's default branch.
		 * @returns The commit SHA; `ref_not_found` when nothing matches.
		 */
		async resolveRef(repository: string, ref: string, defaultBranch: string): Promise<string> {
			if (commitShaSchema.safeParse(ref).success) {
				const comparison = await get(
					`/repos/${repository}/compare/${encodeRef(defaultBranch)}...${ref}`,
					compareResponseSchema,
				);

				if (comparison?.status === 'behind' || comparison?.status === 'identical') {
					return ref;
				}

				throw new ApiError(
					'ref_not_found',
					`${repository} has no commit ${ref} on ${defaultBranch}. Name the branch or tag that holds it.`,
				);
			}

			for (const namespace of ['heads', 'tags']) {
				const found = await get(
					`/repos/${repository}/git/ref/${namespace}/${encodeRef(ref)}`,
					refResponseSchema,
				);

				if (found) {
					return peel(repository, ref, found.object);
				}
			}

			throw refNotFound(repository, ref);
		},

		/**
		 * @description Lists every regular file at a commit; a truncated listing is `invalid_request`.
		 * @param repository The repository as `owner/name`.
		 * @param commitSha The commit.
		 * @returns The files by path.
		 */
		async getTree(repository: string, commitSha: string): Promise<GitTree> {
			const found = await get(
				`/repos/${repository}/git/trees/${commitSha}?recursive=1`,
				treeResponseSchema,
			);

			if (!found) {
				throw unavailable(`no tree for commit ${commitSha}`);
			}

			if (found.truncated) {
				throw new ApiError(
					'invalid_request',
					`${repository} has too many files to read. Publish from a smaller repository.`,
				);
			}

			const tree: GitTree = new Map();

			for (const entry of found.tree) {
				if (entry.type !== 'blob' || entry.mode === SYMLINK_MODE) {
					continue;
				}

				tree.set(entry.path, { sha: entry.sha, size: entry.size ?? 0 });
			}

			return tree;
		},

		/**
		 * @description Downloads a file and checks the bytes hash to its git blob id.
		 * @param repository The repository as `owner/name`.
		 * @param sha The blob id.
		 * @returns The bytes; `github_unavailable` when they do not match the id.
		 */
		async readBlob(repository: string, sha: string): Promise<Uint8Array> {
			const found = await get(`/repos/${repository}/git/blobs/${sha}`, blobResponseSchema);

			if (!found) {
				throw unavailable(`no blob ${sha}`);
			}

			const bytes = new Uint8Array(Buffer.from(found.content, 'base64'));

			if (gitBlobSha(bytes) !== sha) {
				throw unavailable(`blob ${sha} arrived corrupted`);
			}

			return bytes;
		},

		/**
		 * @description Reads the top contributors and the latest release.
		 * @param repository The repository as `owner/name`.
		 * @returns The contributors and the release, `null` when there is none.
		 */
		async getExtras(repository: string): Promise<RepositoryExtras> {
			const [contributors, release] = await Promise.all([
				get(
					`/repos/${repository}/contributors?per_page=${MAX_CONTRIBUTORS}`,
					contributorsResponseSchema,
				),
				get(`/repos/${repository}/releases/latest`, releaseResponseSchema),
			]);

			return {
				contributors: (contributors ?? [])
					.slice(0, MAX_CONTRIBUTORS)
					.map(({ login, contributions }) => ({ login, contributions })),
				latestRelease: release
					? {
							tag: release.tag_name,
							name: release.name,
							publishedAt: release.published_at,
							url: release.html_url,
						}
					: null,
			};
		},

		/**
		 * @description Lists the public repositories the user can push to, most recently pushed first.
		 * @returns The first page of up to 100 repositories.
		 */
		async listPushable(): Promise<PushableRepository[]> {
			const found = await get(
				'/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
				userRepositoriesResponseSchema,
			);

			return (found ?? [])
				.filter((entry) => !entry.private && entry.permissions?.push)
				.map((entry) => ({
					repository: entry.full_name,
					description: entry.description,
					pushedAt: entry.pushed_at,
				}));
		},
	};
}

// Refreshes an expired token first. `undefined` when no GitHub account is linked; throws
// `github_not_linked` when GitHub refuses the refresh.
async function getGitHubToken(ctx: AppContext, userId: string): Promise<string | undefined> {
	const linked = await ctx.db.query.account.findFirst({
		where: { userId, providerId: 'github' },
		columns: { id: true },
	});

	if (!linked) return;

	try {
		const { accessToken } = await ctx.auth.api.getAccessToken({
			body: { accountId: linked.id, userId },
		});

		return accessToken || undefined;
	} catch (error) {
		if (!(error instanceof APIError)) {
			throw error;
		}

		throw linkExpired();
	}
}

/**
 * @description Loads the user's linked GitHub token, counting the request against the user's
 * `GITHUB_RATE_LIMIT_MAX` budget so nobody can spend a user's GitHub quota through us.
 * @param ctx The application context.
 * @param userId The user.
 * @returns A client for that token; `github_not_linked` when none is linked.
 */
export async function connectGitHub(ctx: AppContext, userId: string): Promise<GitHubClient> {
	await consumeRateLimit(ctx, {
		key: `api:github:${userId}`,
		windowSeconds: ctx.env.GITHUB_RATE_LIMIT_WINDOW_SECONDS,
		max: ctx.env.GITHUB_RATE_LIMIT_MAX,
	});

	const token = await getGitHubToken(ctx, userId);

	if (!token) {
		throw new ApiError('github_not_linked', 'Link your GitHub account to publish from GitHub.');
	}

	return createGitHubClient(ctx.env, token);
}

/**
 * @description Builds a client for public reads that uses the user's GitHub token when one is linked.
 * @param ctx The application context.
 * @param userId The user.
 * @returns A client for the user's token, or the app's anonymous client when no link exists or it expired.
 */
export async function connectGitHubIfLinked(
	ctx: AppContext,
	userId: string,
): Promise<GitHubClient> {
	try {
		return createGitHubClient(ctx.env, (await getGitHubToken(ctx, userId)) ?? null);
	} catch (error) {
		if (!(error instanceof ApiError) || error.code !== 'github_not_linked') {
			throw error;
		}

		return createGitHubClient(ctx.env, null);
	}
}

export default {
	gitBlobSha,
	getGitHubAuthorization,
	createGitHubClient,
	connectGitHub,
	connectGitHubIfLinked,
};
