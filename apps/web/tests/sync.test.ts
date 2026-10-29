import {
	emptySyncDocument,
	SYNC_KINDS,
	syncDeleteResponseSchema,
	syncOAuthConfigSchema,
	syncSignInResponseSchema,
	syncStateSchema,
} from '@unbound-app/contracts/sync';
import type { SyncDocumentInput, SyncSignInResponse } from '@unbound-app/contracts/sync';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import getSyncOAuthEndpoint from '~/endpoints/get-sync-oauth';
import syncSignInEndpoint from '~/endpoints/sync-sign-in';
import deleteSyncEndpoint from '~/endpoints/delete-sync';
import getSyncEndpoint from '~/endpoints/get-sync';
import putSyncEndpoint from '~/endpoints/put-sync';
import { createApiClient } from '~/api/client';
import { account, user } from '~/db/schema';
import type { Api } from '~/api';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';

type FakeDiscordUser = {
	id: string;
	username: string;
	global_name: string | null;
	avatar: string | null;
	email: string;
	verified: boolean;
};

const ALICE_ID = '80351110224678912';

const DISCORD_USERS: Record<string, FakeDiscordUser> = {
	'code-alice': {
		id: ALICE_ID,
		username: 'alice',
		global_name: 'Alice',
		avatar: null,
		email: 'alice@example.com',
		verified: true,
	},
	'code-banned': {
		id: '80351110224678913',
		username: 'mallory',
		global_name: null,
		avatar: 'abc',
		email: 'mallory@example.com',
		verified: true,
	},
};

const exchanges: URLSearchParams[] = [];

// Discord's token exchange and `GET /users/@me`, under the same `/api/v10` base path as production.
const discord = Bun.serve({
	port: 0,
	routes: {
		'/api/v10/oauth2/token': {
			POST: async (request) => {
				const form = new URLSearchParams(await request.text());
				const code = form.get('code') ?? '';

				exchanges.push(form);

				if (!DISCORD_USERS[code]) {
					return Response.json({ error: 'invalid_grant' }, { status: 400 });
				}

				return Response.json({
					access_token: code,
					token_type: 'Bearer',
					scope: 'identify email',
				});
			},
		},
		'/api/v10/users/@me': (request) => {
			const code = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
			const profile = DISCORD_USERS[code];

			if (!profile) {
				return Response.json({ message: '401: Unauthorized' }, { status: 401 });
			}

			return Response.json({ ...profile, discriminator: '0' });
		},
	},
});

const base = await createTestContext({
	DISCORD_API_URL: new URL('/api/v10', discord.url).href,
	SYNC_RATE_LIMIT_MAX: '1000',
	SYNC_SIGN_IN_RATE_LIMIT_MAX: '1000',
});
const ctx = base.ctx;
const server = serveEndpoints(ctx, {
	'GET /api/v1/sync/oauth': getSyncOAuthEndpoint,
	'POST /api/v1/sync/oauth': syncSignInEndpoint,
	'GET /api/v1/sync': getSyncEndpoint,
	'PUT /api/v1/sync': putSyncEndpoint,
	'DELETE /api/v1/sync': deleteSyncEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await server.stop(true);
	await discord.stop(true);
	await base.close();
});

let users = 0;

async function signIn() {
	users += 1;

	const { headers } = await signInWithDiscord(ctx, {
		id: `9035111022467${String(users).padStart(4, '0')}`,
		name: `Syncer ${users}`,
		email: `syncer${users}@example.com`,
	});

	return headers;
}

function exchange(code: string): Promise<SyncSignInResponse> {
	return client('POST /api/v1/sync/oauth', {
		body: { code },
		response: syncSignInResponseSchema,
	});
}

function getState(headers: Headers) {
	return client('GET /api/v1/sync', { headers, response: syncStateSchema });
}

function put(headers: Headers, revision: number, document: SyncDocumentInput) {
	return client('PUT /api/v1/sync', {
		headers,
		body: { revision, document },
		response: syncStateSchema,
	});
}

function documentWith(overrides: Partial<SyncDocumentInput>): SyncDocumentInput {
	return { ...emptySyncDocument(), ...overrides };
}

function plugins(...ids: string[]): SyncDocumentInput['addons'] {
	return {
		plugins: {
			installs: ids.map((id) => ({
				id,
				url: `https://example.com/${id}/manifest.json`,
				enabled: true,
			})),
			applied: null,
		},
	};
}

describe('GET /api/v1/sync/oauth', () => {
	test('describes the in-app Discord authorize request', async () => {
		const config = await client('GET /api/v1/sync/oauth', { response: syncOAuthConfigSchema });

		expect(config).toEqual({
			clientId: 'discord-client',
			redirectUri: 'http://localhost:3000/api/auth/callback/discord',
			scopes: ['identify', 'email'],
		});
	});
});

describe('POST /api/v1/sync/oauth', () => {
	test('creates the account on first sign-in, then reuses it', async () => {
		const first = await exchange('code-alice');
		const second = await exchange('code-alice');

		expect(first.user).toMatchObject({ name: 'Alice', role: 'user' });
		expect(first.user.image).toMatch(
			/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/,
		);
		expect(second.user.id).toBe(first.user.id);
		expect(second.token).not.toBe(first.token);

		const accounts = await ctx.db.select().from(account).where(eq(account.accountId, ALICE_ID));

		expect(accounts.map((row) => [row.providerId, row.userId])).toEqual([
			['discord', first.user.id],
		]);

		const state = await getState(new Headers({ authorization: `Bearer ${second.token}` }));

		expect(state.revision).toBe(0);
	});

	test('exchanges the code with the client secret and the registered redirect URI', async () => {
		await exchange('code-alice');

		const form = exchanges.at(-1);

		expect(form?.get('client_id')).toBe('discord-client');
		expect(form?.get('client_secret')).toBe('discord-secret');
		expect(form?.get('grant_type')).toBe('authorization_code');
		expect(form?.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/discord');
	});

	test('refuses a code Discord rejects', async () => {
		expect(await failure(exchange('code-unknown'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});

	test('refuses a banned user without opening a session', async () => {
		const { user: banned } = await exchange('code-banned');

		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, banned.id));

		expect(await failure(exchange('code-banned'))).toEqual({ status: 403, code: 'forbidden' });
	});
});

describe('/api/v1/sync', () => {
	test('refuses anonymous callers', async () => {
		expect(await failure(client('GET /api/v1/sync', { response: syncStateSchema }))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
		expect(await failure(put(new Headers(), 0, emptySyncDocument()))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
	});

	test('answers revision 0 with an empty document before the first save', async () => {
		expect(await getState(await signIn())).toEqual({
			revision: 0,
			updatedAt: null,
			document: emptySyncDocument(),
		});
	});

	test('round-trips a saved document', async () => {
		const headers = await signIn();
		const document = documentWith({
			addons: {
				...plugins('cat.plugin'),
				themes: {
					installs: [
						{
							id: 'cat.theme',
							url: 'http://cdn.localhost:3000/theme.json',
							enabled: true,
						},
					],
					applied: 'cat.theme',
				},
			},
			settings: { unbound: { 'staff-mode': true }, 'cat.plugin': { volume: 3 } },
		});

		const saved = await put(headers, 0, document);

		expect(saved.revision).toBe(1);
		expect(saved.updatedAt).not.toBeNull();
		expect(await getState(headers)).toEqual(saved);
		expect(saved.document.addons.themes.applied).toBe('cat.theme');
		expect(saved.document.settings).toEqual({
			unbound: { 'staff-mode': true },
			'cat.plugin': { volume: 3 },
		});
	});

	test('stores settings holding NUL or a lone surrogate whole', async () => {
		const headers = await signIn();
		const settings = { 'cat.plugin': { nul: 'a\0b', lone: 'a\ud800b', 'ke\0y': true } };
		const saved = await put(
			headers,
			0,
			documentWith({ addons: plugins('cat.plugin'), settings }),
		);

		expect(saved.document.settings).toEqual(settings);
		expect((await getState(headers)).document.settings).toEqual(settings);
	});

	test('rejects a save against a stale revision with a conflict', async () => {
		const headers = await signIn();

		await put(headers, 0, emptySyncDocument());
		await put(headers, 1, emptySyncDocument());

		expect(await failure(put(headers, 1, emptySyncDocument()))).toEqual({
			status: 409,
			code: 'sync_conflict',
		});
		expect(await failure(put(headers, 0, emptySyncDocument()))).toEqual({
			status: 409,
			code: 'sync_conflict',
		});
		expect((await getState(headers)).revision).toBe(2);
	});

	test('deletes the document', async () => {
		const headers = await signIn();

		await put(headers, 0, documentWith({ addons: plugins('gone.plugin') }));

		const deleted = await client('DELETE /api/v1/sync', {
			headers,
			response: syncDeleteResponseSchema,
		});

		expect(deleted).toEqual({ deleted: true });
		expect((await getState(headers)).revision).toBe(0);
	});
});

describe('stripping', () => {
	async function strip(document: SyncDocumentInput) {
		return (await put(await signIn(), 0, document)).document;
	}

	test('drops cache stores, device-local keys, manager stores and unknown addon stores', async () => {
		const { settings } = await strip(
			documentWith({
				addons: plugins('kept.plugin'),
				settings: {
					unbound: {
						recovery: true,
						debugger: { enabled: true },
						loader: { update: { url: 'http://evil.example/unbound.bundle' } },
						toasts: { enabled: false },
					},
					'unbound::cache': { modules: 1 },
					'unbound::sync': { token: 'secret' },
					plugins: { states: {} },
					'kept.plugin': { a: 1 },
					'unknown.plugin': { a: 1 },
				},
			}),
		);

		expect(settings).toEqual({
			unbound: { toasts: { enabled: false } },
			'kept.plugin': { a: 1 },
		});
	});

	test('drops non-http URLs and malformed ids, and removes credentials and fragments', async () => {
		const { addons } = await strip(
			documentWith({
				addons: {
					plugins: {
						installs: [
							{
								id: 'a.plugin',
								url: 'https://user:pass@example.com/a.json#x',
								enabled: true,
							},
							{ id: 'b.plugin', url: 'javascript:alert(1)', enabled: true },
							{ id: 'c.plugin', url: 'file:///etc/passwd', enabled: true },
							{ id: 'd.plugin', url: 'not a url', enabled: true },
							{ id: '../escape', url: 'https://example.com/e.json', enabled: true },
							{
								id: 'f.plugin',
								url: `https://example.com/${'f'.repeat(2048)}`,
								enabled: true,
							},
						],
						applied: 'a.plugin',
					},
				},
			}),
		);

		expect(addons.plugins).toEqual({
			installs: [{ id: 'a.plugin', url: 'https://example.com/a.json', enabled: true }],
			applied: null,
		});
	});

	test('drops unknown top-level keys and unknown kinds', async () => {
		const headers = await signIn();
		const response = await fetch(new URL('/api/v1/sync', server.url), {
			method: 'PUT',
			headers: { ...Object.fromEntries(headers), 'content-type': 'application/json' },
			body: JSON.stringify({
				revision: 0,
				document: {
					...documentWith({ addons: plugins('a.plugin') }),
					bundles: { 'a.plugin': 'eval(1)' },
					addons: { ...plugins('a.plugin'), scripts: { installs: [], applied: null } },
				},
			}),
		});
		const state = syncStateSchema.parse(await response.json());

		expect(Object.keys(state.document).toSorted()).toEqual(
			Object.keys(emptySyncDocument()).toSorted(),
		);
		expect(Object.keys(state.document.addons).toSorted()).toEqual([...SYNC_KINDS].toSorted());
	});

	test('keeps applied only when it names a kept install or the default icon pack', async () => {
		const { addons } = await strip(
			documentWith({
				addons: {
					themes: { installs: [], applied: 'missing.theme' },
					icons: { installs: [], applied: 'default' },
				},
			}),
		);

		expect(addons.themes.applied).toBeNull();
		expect(addons.icons.applied).toBe('default');
	});

	test('collapses duplicate ids to the last occurrence', async () => {
		const document = documentWith({ addons: plugins('a.plugin', 'b.plugin') });

		document.addons.plugins?.installs.push({
			id: 'a.plugin',
			url: 'https://example.com/last.json',
			enabled: false,
		});

		const { addons } = await strip(document);

		expect(addons.plugins.installs).toEqual([
			{ id: 'b.plugin', url: 'https://example.com/b.plugin/manifest.json', enabled: true },
			{ id: 'a.plugin', url: 'https://example.com/last.json', enabled: false },
		]);
	});

	test('caps installs per kind at 100', async () => {
		const ids = Array.from({ length: 120 }, (_, index) => `p${index}.plugin`);
		const { addons } = await strip(documentWith({ addons: plugins(...ids) }));

		expect(addons.plugins.installs.map((install) => install.id)).toEqual(ids.slice(0, 100));
	});

	test('drops an oversize store and too-deep values', async () => {
		let deep: SyncDocumentInput['settings'][string][string] = 'leaf';

		for (let index = 0; index < 9; index++) {
			deep = { deep };
		}

		const { settings } = await strip(
			documentWith({
				addons: plugins('big.plugin', 'deep.plugin'),
				settings: {
					'big.plugin': { blob: 'x'.repeat(33 * 1024) },
					'deep.plugin': { deep, shallow: [1, [2]] },
				},
			}),
		);

		expect(settings).toEqual({ 'deep.plugin': { shallow: [1, [2]] } });
	});

	test('refuses a document over the size cap', async () => {
		const ids = Array.from({ length: 10 }, (_, index) => `big${index}.plugin`);
		const settings = Object.fromEntries(ids.map((id) => [id, { blob: 'x'.repeat(30 * 1024) }]));

		expect(
			await failure(
				put(await signIn(), 0, documentWith({ addons: plugins(...ids), settings })),
			),
		).toEqual({ status: 413, code: 'sync_document_too_large' });
	});
});
