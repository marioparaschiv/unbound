import {
	listRepositoryAddonsResponseSchema,
	pushableRepositoriesResponseSchema,
} from '@unbound-app/contracts/source';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { APIError } from 'better-auth/api';

import listGitHubRepositoriesEndpoint from '~/endpoints/list-github-repositories';
import listRepositoryAddonsEndpoint from '~/endpoints/list-repository-addons';
import { connectGitHubIfLinked } from '~/lib/github';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import type { Api } from '~/api';

import { createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';
import { serveGitHub } from './helpers/github';

const MONOREPO = 'acme/addons';
const BARE = 'acme/bare';
const PRIVATE = 'acme/secret';

const github = serveGitHub({
	repositories: {
		[MONOREPO]: {
			description: 'Addons by Acme.',
			homepage: 'https://acme.example',
			topics: ['discord', 'unbound'],
			license: 'MIT',
			stars: 42,
			contributors: [{ login: 'acme-dev', contributions: 12 }],
			latestRelease: { tag: 'v1.0.0', name: 'First', publishedAt: '2026-09-01T00:00:00Z' },
		},
		[BARE]: { homepage: 'not a url', license: 'NOASSERTION' },
		[PRIVATE]: { private: true },
		'acme/huge': { truncated: true },
	},
	tokens: {
		owner: { push: [MONOREPO, BARE, PRIVATE, 'acme/huge'] },
		reader: { push: [] },
	},
});

function manifestJson(id: string, main: string = 'index.js', version: string = '1.0.0') {
	return JSON.stringify({
		id,
		name: id,
		description: `The ${id} addon.`,
		authors: [{ name: 'Acme', id: '1234' }],
		version,
		main,
	});
}

const BUILD = JSON.stringify({ scripts: { build: 'bun build' } });

const main = github.repository(MONOREPO).commit({
	'README.md': '# Acme addons',
	'unbound.config.json': JSON.stringify({ addons: ['plugins/*', 'themes/*'] }),
	'plugins/hello/manifest.json': manifestJson('acme.hello', 'src/index.ts'),
	'plugins/hello/package.json': BUILD,
	'plugins/hello/src/index.ts': 'export default {};',
	'plugins/hello/dist/index.js': 'module.exports = {};',
	'plugins/hello/ADDON.md': '# Hello',
	'plugins/nodist/manifest.json': manifestJson('acme.nodist', 'src/index.ts'),
	'plugins/nodist/package.json': BUILD,
	'plugins/broken/manifest.json': manifestJson('acme.broken', 'index.js', 'one'),
	'plugins/broken/index.js': 'module.exports = {};',
	'plugins/wip/manifest.json': JSON.stringify({ name: 'wip' }),
	'themes/dark/manifest.json': manifestJson('acme.dark', 'theme.json'),
	'themes/dark/theme.json': '{}',
	'themes/dark/CHANGELOG.md': '## [1.0.0]\n\n### Added\n\n- Dark.\n',
	'scratch/manifest.json': manifestJson('acme.scratch'),
	'nested/unbound.config.json': JSON.stringify({ addons: ['packages/*'] }),
	'nested/packages/inner/manifest.json': manifestJson('acme.inner'),
	'nested/packages/inner/index.js': 'module.exports = {};',
});

github.repository(BARE).commit({
	'manifest.json': manifestJson('acme.bare'),
	'index.js': 'module.exports = {};',
});

github.repository('acme/huge').commit({ 'manifest.json': manifestJson('acme.huge') });

const base = await createTestContext({
	GITHUB_API_URL: github.url.href,
	GITHUB_RATE_LIMIT_MAX: '1000',
});
const ctx = base.ctx;
const server = serveEndpoints(ctx, {
	'GET /api/v1/github/repositories': listGitHubRepositoriesEndpoint,
	'GET /api/v1/github/addons': listRepositoryAddonsEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

// Better Auth's GitHub provider hard-codes this endpoint, so the refresh is answered at fetch.
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const REFRESH_TOKEN = 'refresh-owner';
const realFetch = globalThis.fetch;
const refreshes: URLSearchParams[] = [];

async function answerTokenRefresh(input: string | URL | Request, init?: RequestInit) {
	const url = input instanceof Request ? input.url : input.toString();

	if (url !== GITHUB_TOKEN_ENDPOINT) {
		return realFetch(input, init);
	}

	const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : undefined);

	refreshes.push(form);

	// GitHub answers a bad refresh token with a 200 and an error body.
	if (form.get('refresh_token') !== REFRESH_TOKEN) {
		return Response.json({ error: 'bad_refresh_token' });
	}

	return Response.json({
		access_token: 'owner',
		token_type: 'bearer',
		expires_in: 28800,
		refresh_token: 'refresh-owner-renewed',
		refresh_token_expires_in: 15897600,
	});
}

const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
	Object.assign(answerTokenRefresh, { preconnect: realFetch.preconnect }),
);

afterAll(async () => {
	fetchSpy.mockRestore();
	await server.stop(true);
	await github.stop();
	await base.close();
});

let users = 0;

async function signIn(
	target: AppContext = ctx,
	token: string | null = 'owner',
	expiring?: Parameters<typeof linkGitHub>[3],
) {
	users += 1;

	const { userId, headers } = await signInWithDiscord(target, {
		id: String(80351110224678912n + BigInt(users)),
		name: `Author ${users}`,
		email: `author${users}@example.com`,
	});

	if (token) {
		await linkGitHub(target, userId, token, expiring);
	}

	return headers;
}

function listAddons(headers: Headers, repository: string, ref?: string) {
	return client('GET /api/v1/github/addons', {
		headers,
		query: { repository, ref },
		response: listRepositoryAddonsResponseSchema,
	});
}

describe('GET /api/v1/github/repositories', () => {
	test('lists the public repositories the linked account can push to', async () => {
		const owner = await signIn();
		const reader = await signIn(ctx, 'reader');
		const response = pushableRepositoriesResponseSchema;

		const owned = await client('GET /api/v1/github/repositories', { headers: owner, response });
		const read = await client('GET /api/v1/github/repositories', { headers: reader, response });

		expect(owned.repositories.map((entry) => entry.repository).sort()).toEqual(
			[MONOREPO, BARE, 'acme/huge'].sort(),
		);
		expect(read.repositories).toEqual([]);
	});

	test('asks for a GitHub link first', async () => {
		const headers = await signIn(ctx, null);
		const request = client('GET /api/v1/github/repositories', {
			headers,
			response: pushableRepositoriesResponseSchema,
		});

		expect(await failure(request)).toEqual({ status: 403, code: 'github_not_linked' });
	});

	test('refreshes an expired GitHub token before calling GitHub', async () => {
		const expired = new Date(Date.now() - 60_000);
		const headers = await signIn(ctx, 'expired', {
			accessTokenExpiresAt: expired,
			refreshToken: REFRESH_TOKEN,
		});

		const listed = await client('GET /api/v1/github/repositories', {
			headers,
			response: pushableRepositoriesResponseSchema,
		});

		expect(listed.repositories.map((entry) => entry.repository)).toContain(MONOREPO);
		expect(refreshes.at(-1)?.get('grant_type')).toBe('refresh_token');
		expect(refreshes.at(-1)?.get('client_id')).toBe(ctx.env.GITHUB_CLIENT_ID);

		const stored = await ctx.db.query.account.findFirst({
			where: { accessToken: 'owner', refreshToken: 'refresh-owner-renewed' },
			columns: { accessTokenExpiresAt: true },
		});

		expect(stored?.accessTokenExpiresAt?.getTime()).toBeGreaterThan(Date.now());
	});

	test('asks to link GitHub again when the refresh token is refused', async () => {
		const headers = await signIn(ctx, 'expired', {
			accessTokenExpiresAt: new Date(Date.now() - 60_000),
			refreshToken: 'refresh-revoked',
		});
		const request = client('GET /api/v1/github/repositories', {
			headers,
			response: pushableRepositoriesResponseSchema,
		});

		expect(await failure(request)).toEqual({ status: 403, code: 'github_not_linked' });
		expect(refreshes.at(-1)?.get('refresh_token')).toBe('refresh-revoked');
	});
});

describe('GET /api/v1/github/addons', () => {
	test('lists a monorepo by its configs, with issues and skipped directories', async () => {
		const listing = await listAddons(await signIn(), `https://github.com/${MONOREPO}.git`);

		expect(listing).toMatchObject({ repository: MONOREPO, ref: 'main', commitSha: main });
		expect(listing.addons.map((addon) => [addon.path, addon.id, addon.kind])).toEqual([
			['nested/packages/inner', 'acme.inner', 'plugin'],
			['plugins/broken', 'acme.broken', 'plugin'],
			['plugins/hello', 'acme.hello', 'plugin'],
			['plugins/nodist', 'acme.nodist', 'plugin'],
			['themes/dark', 'acme.dark', 'theme'],
		]);

		const byId = new Map(listing.addons.map((addon) => [addon.id, addon]));

		expect(byId.get('acme.hello')).toMatchObject({
			name: 'acme.hello',
			version: '1.0.0',
			static: false,
			bundle: 'plugins/hello/dist/index.js',
			hasAddonMd: true,
			hasChangelog: false,
			issues: [],
		});
		expect(byId.get('acme.dark')).toMatchObject({
			static: true,
			bundle: 'themes/dark/theme.json',
			hasChangelog: true,
			issues: [],
		});
		expect(byId.get('acme.nodist')?.issues).toEqual([
			expect.stringContaining('plugins/nodist/dist/index.js'),
		]);
		expect(byId.get('acme.broken')).toMatchObject({ name: null, version: null });
		expect(byId.get('acme.broken')?.issues).toEqual([
			expect.stringContaining('plugins/broken/manifest.json'),
		]);
		expect(listing.skipped.map((entry) => entry.path).sort()).toEqual([
			'plugins/wip',
			'scratch',
		]);
	});

	test('snapshots the repository details', async () => {
		const listing = await listAddons(await signIn(), MONOREPO);

		expect(listing.details).toEqual({
			description: 'Addons by Acme.',
			homepage: 'https://acme.example/',
			tags: ['discord', 'unbound'],
			license: 'MIT',
			stars: 42,
			defaultBranch: 'main',
			htmlUrl: `https://github.com/${MONOREPO}`,
			readmeUrl: `https://github.com/${MONOREPO}#readme`,
			contributors: [{ login: 'acme-dev', contributions: 12 }],
			latestRelease: {
				tag: 'v1.0.0',
				name: 'First',
				publishedAt: '2026-09-01T00:00:00Z',
				url: `https://github.com/${MONOREPO}/releases/tag/v1.0.0`,
			},
		});
	});

	test('lists a repository without a config as one bare addon', async () => {
		const listing = await listAddons(await signIn(), BARE);

		expect(listing.addons).toEqual([
			{
				id: 'acme.bare',
				name: 'acme.bare',
				version: '1.0.0',
				kind: 'plugin',
				path: '',
				static: true,
				bundle: 'index.js',
				hasAddonMd: false,
				hasChangelog: false,
				issues: [],
			},
		]);
		expect(listing.details).toMatchObject({ homepage: null, license: null, readmeUrl: null });
	});

	test('resolves branches, annotated tags and SHAs on the default branch', async () => {
		const headers = await signIn();
		const fixture = github.repository(BARE);
		const first = fixture.resolve('main');

		fixture.tag('v1', { annotated: true });
		fixture.commit({ 'feature.txt': 'wip' }, { branch: 'feature/next' });

		const second = fixture.commit({ 'index.js': 'module.exports = 2;' });

		expect((await listAddons(headers, BARE, 'v1')).commitSha).toBe(first);
		expect((await listAddons(headers, BARE, 'feature/next')).commitSha).toBe(
			fixture.resolve('feature/next'),
		);
		expect((await listAddons(headers, BARE, first)).commitSha).toBe(first);
		expect((await listAddons(headers, BARE)).commitSha).toBe(second);
	});

	test('refuses an unknown ref and a SHA that is not on the default branch', async () => {
		const headers = await signIn();
		const fixture = github.repository(BARE);
		const forkOnly = fixture.commit({ 'fork.txt': 'fork' }, { branch: null });
		const sideBranch = fixture.commit({ 'side.txt': 'side' }, { branch: 'side' });

		for (const ref of ['v9.9.9', forkOnly, sideBranch]) {
			expect(await failure(listAddons(headers, BARE, ref))).toEqual({
				status: 404,
				code: 'ref_not_found',
			});
		}
	});

	test('refuses private, missing and unpushable repositories', async () => {
		const owner = await signIn();
		const reader = await signIn(ctx, 'reader');

		expect(await failure(listAddons(owner, PRIVATE))).toEqual({
			status: 404,
			code: 'repository_not_found',
		});
		expect(await failure(listAddons(owner, 'acme/missing'))).toEqual({
			status: 404,
			code: 'repository_not_found',
		});
		expect(await failure(listAddons(reader, MONOREPO))).toEqual({
			status: 403,
			code: 'github_no_push_access',
		});
	});

	test('reports a revoked token, an unlinked account and an invalid repository', async () => {
		expect(await failure(listAddons(await signIn(ctx, 'revoked'), MONOREPO))).toEqual({
			status: 403,
			code: 'github_not_linked',
		});
		expect(await failure(listAddons(await signIn(ctx, null), MONOREPO))).toEqual({
			status: 403,
			code: 'github_not_linked',
		});
		expect(await failure(listAddons(await signIn(), 'https://gitlab.com/acme/addons'))).toEqual(
			{ status: 400, code: 'invalid_request' },
		);
	});

	test('refuses a repository too large to list in one tree', async () => {
		expect(await failure(listAddons(await signIn(), 'acme/huge'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});

	test('reports GitHub outages and rate limits as github_unavailable', async () => {
		const headers = await signIn();

		github.outage(503);

		try {
			expect(await failure(listAddons(headers, MONOREPO))).toEqual({
				status: 502,
				code: 'github_unavailable',
			});

			github.outage(403);

			expect(await failure(listAddons(headers, MONOREPO))).toEqual({
				status: 502,
				code: 'github_unavailable',
			});
		} finally {
			github.outage(null);
		}
	});

	test('limits GitHub reads per user to GITHUB_RATE_LIMIT_MAX per window', async () => {
		const limited = await createTestContext({
			GITHUB_API_URL: github.url.href,
			GITHUB_RATE_LIMIT_MAX: '2',
		});
		const limitedServer = serveEndpoints(limited.ctx, {
			'GET /api/v1/github/addons': listRepositoryAddonsEndpoint,
		});
		const limitedClient = createApiClient<Api>({ baseUrl: limitedServer.url.href });

		try {
			const headers = await signIn(limited.ctx);
			const request = () =>
				limitedClient('GET /api/v1/github/addons', {
					headers,
					query: { repository: BARE },
					response: listRepositoryAddonsResponseSchema,
				});

			await request();
			await request();

			expect(await failure(request())).toEqual({ status: 429, code: 'rate_limited' });
		} finally {
			await limitedServer.stop(true);
			await limited.close();
		}
	});
});

describe('connectGitHubIfLinked', () => {
	async function linkedUser(token: string | null, expiring?: Parameters<typeof linkGitHub>[3]) {
		users += 1;

		const { userId } = await signInWithDiscord(ctx, {
			id: String(80351110224678912n + BigInt(users)),
			name: `Author ${users}`,
			email: `author${users}@example.com`,
		});

		if (token) {
			await linkGitHub(ctx, userId, token, expiring);
		}

		return userId;
	}

	test("reads with the user's token when GitHub is linked", async () => {
		const github = await connectGitHubIfLinked(ctx, await linkedUser('owner'));
		const pushable = await github.listPushable();

		expect(pushable.map((entry) => entry.repository)).toContain(MONOREPO);
	});

	test('falls back to anonymous reads when nothing is linked', async () => {
		const github = await connectGitHubIfLinked(ctx, await linkedUser(null));

		expect((await github.getRepository(MONOREPO)).defaultBranch).toBe('main');
	});

	test('falls back to anonymous reads when Better Auth refuses the token', async () => {
		const userId = await linkedUser('owner');
		const refused = new APIError('UNAUTHORIZED', { message: 'Failed to refresh' });
		const getAccessToken = spyOn(ctx.auth.api, 'getAccessToken').mockRejectedValue(refused);

		try {
			const github = await connectGitHubIfLinked(ctx, userId);

			expect((await github.getRepository(MONOREPO)).defaultBranch).toBe('main');
			expect(await github.listPushable()).toEqual([]);
		} finally {
			getAccessToken.mockRestore();
		}
	});

	test('rethrows a failure that is not an expired link', async () => {
		const userId = await linkedUser('owner');
		const outage = new Error('database unavailable');
		const getAccessToken = spyOn(ctx.auth.api, 'getAccessToken').mockRejectedValue(outage);

		try {
			let thrown;

			try {
				await connectGitHubIfLinked(ctx, userId);
			} catch (error) {
				thrown = error;
			}

			expect(thrown).toBe(outage);
		} finally {
			getAccessToken.mockRestore();
		}
	});
});
