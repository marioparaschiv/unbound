import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { account, rateLimit, session, user } from '~/db/schema';
import { API_KEY_HEADER, CLI_CLIENT_ID } from '~/api/client';
import me from '~/endpoints/me';

import { authRequest, createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

function meRequest(headers: Headers) {
	return me.handle(ctx, new Request(new URL('/api/v1/me', ctx.env.PUBLIC_URL), { headers }));
}

describe('Discord sign-in', () => {
	test('redirects to Discord with the identify and email scopes', async () => {
		const response = await authRequest(ctx, '/sign-in/social', {
			method: 'POST',
			body: JSON.stringify({ provider: 'discord', callbackURL: '/' }),
		});

		expect(response.status).toBe(200);

		const { url } = await response.json();
		const authorize = new URL(url);

		expect(authorize.origin).toBe('https://discord.com');
		expect(authorize.searchParams.get('client_id')).toBe(ctx.env.DISCORD_CLIENT_ID);
		expect(authorize.searchParams.get('scope')?.split(' ')).toEqual(
			expect.arrayContaining(['identify', 'email']),
		);
	});

	test('creates a user with the user role, returned by get-session', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678912',
			name: 'Nelly',
			email: 'nelly@example.com',
		});

		const response = await authRequest(ctx, '/get-session', { headers });
		const session = await response.json();

		expect(session.user.id).toBe(userId);
		expect(session.user.role).toBe('user');
	});
});

describe('GitHub', () => {
	test('cannot be used to sign in or sign up', async () => {
		const response = await authRequest(ctx, '/sign-in/social', {
			method: 'POST',
			body: JSON.stringify({ provider: 'github', callbackURL: '/' }),
		});

		expect(response.status).toBe(403);
	});

	test('can be linked to a signed-in account', async () => {
		const { headers } = await signInWithDiscord(ctx, {
			id: '80351110224678913',
			name: 'Linker',
			email: 'linker@example.com',
		});

		const response = await authRequest(ctx, '/link-social', {
			method: 'POST',
			headers,
			body: JSON.stringify({ provider: 'github', callbackURL: '/' }),
		});

		expect(response.status).toBe(200);
		expect(new URL((await response.json()).url).origin).toBe('https://github.com');
	});

	test('can be unlinked from a session signed in days ago', async () => {
		const { userId, token, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678917',
			name: 'Unlinker',
			email: 'unlinker@example.com',
		});
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

		await linkGitHub(ctx, userId, 'github-token');
		await ctx.db
			.update(session)
			.set({ createdAt: threeDaysAgo })
			.where(eq(session.token, token));

		const linked = await ctx.db.query.account.findFirst({
			where: { userId, providerId: 'github' },
			columns: { id: true },
		});
		const response = await authRequest(ctx, '/unlink-account', {
			method: 'POST',
			headers,
			body: JSON.stringify({ accountId: linked?.id }),
		});
		const providers = await ctx.db
			.select({ providerId: account.providerId })
			.from(account)
			.where(eq(account.userId, userId));

		expect(response.status).toBe(200);
		expect(providers).toEqual([{ providerId: 'discord' }]);
	});

	test('linking requires a session', async () => {
		const response = await authRequest(ctx, '/link-social', {
			method: 'POST',
			body: JSON.stringify({ provider: 'github', callbackURL: '/' }),
		});

		expect(response.status).toBe(401);
	});
});

describe('device authorization', () => {
	test('issues a device and user code to the CLI client', async () => {
		const response = await authRequest(ctx, '/device/code', {
			method: 'POST',
			body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
		});

		expect(response.status).toBe(200);

		const body = await response.json();

		expect(body.device_code).toBeString();
		expect(body.user_code).toBeString();
		expect(new URL(body.verification_uri).pathname).toBe('/device');
	});

	test('rejects an unknown client', async () => {
		const response = await authRequest(ctx, '/device/code', {
			method: 'POST',
			body: JSON.stringify({ client_id: 'someone-else' }),
		});

		expect(response.status).toBe(400);
	});
});

describe('API keys', () => {
	test('a signed-in user creates a key that authenticates /api/v1 requests', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678914',
			name: 'Publisher',
			email: 'publisher@example.com',
		});

		const response = await authRequest(ctx, '/api-key/create', {
			method: 'POST',
			headers,
			body: JSON.stringify({ name: 'ci' }),
		});

		expect(response.status).toBe(200);

		const { key } = await response.json();
		const result = await meRequest(new Headers({ [API_KEY_HEADER]: key }));

		expect(result.status).toBe(200);
		expect((await result.json()).user).toEqual({
			id: userId,
			name: 'Publisher',
			image: null,
			role: 'user',
		});
	});

	test("a banned owner's key is unauthorized until the ban expires", async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678916',
			name: 'Banned',
			email: 'banned@example.com',
		});

		const created = await authRequest(ctx, '/api-key/create', {
			method: 'POST',
			headers,
			body: JSON.stringify({ name: 'ci' }),
		});
		const { key } = await created.json();
		const banExpires = new Date(Date.UTC(2026, 9, 20));

		await ctx.db.update(user).set({ banned: true, banExpires }).where(eq(user.id, userId));

		function meAt(now: Date) {
			const target = { ...ctx, now: () => now };
			const request = new Request(new URL('/api/v1/me', ctx.env.PUBLIC_URL), {
				headers: { [API_KEY_HEADER]: key },
			});

			return me.handle(target, request);
		}

		expect((await meAt(new Date(Date.UTC(2026, 9, 19)))).status).toBe(401);
		expect((await meAt(new Date(Date.UTC(2026, 9, 21)))).status).toBe(200);
	});

	test('an invalid key is unauthorized', async () => {
		const result = await meRequest(new Headers({ [API_KEY_HEADER]: 'not-a-key' }));

		expect(result.status).toBe(401);
		expect((await result.json()).error.code).toBe('unauthorized');
	});
});

describe('text Postgres cannot store', () => {
	test('is refused in a body or a query before it reaches the database', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678920',
			name: 'Unstored',
			email: 'unstored@example.com',
		});
		const requests = [
			['/update-user', { method: 'POST', body: JSON.stringify({ name: 'Nul\0name' }) }],
			['/update-user', { method: 'POST', body: JSON.stringify({ name: 'Half\ud800name' }) }],
			['/api-key/create', { method: 'POST', body: JSON.stringify({ name: 'key\0' }) }],
			['/device?user_code=AB%00CD', {}],
		] as const;

		const statuses: number[] = [];

		for (const [path, init] of requests) {
			statuses.push((await authRequest(ctx, path, { ...init, headers })).status);
		}

		expect(statuses).toEqual([400, 400, 400, 400]);

		const [stored] = await ctx.db
			.select({ name: user.name })
			.from(user)
			.where(eq(user.id, userId));

		expect(stored?.name).toBe('Unstored');
	});
});

describe('rate limiting', () => {
	test('is stored in the database and rejects requests over the limit', async () => {
		const limited = await createTestContext({
			AUTH_RATE_LIMIT_MAX: '2',
			AUTH_RATE_LIMIT_WINDOW_SECONDS: '60',
		});

		try {
			const headers = { 'x-forwarded-for': '203.0.113.7' };
			const statuses: number[] = [];

			for (let i = 0; i < 3; i++) {
				statuses.push((await authRequest(limited.ctx, '/ok', { headers })).status);
			}

			expect(statuses).toEqual([200, 200, 429]);

			const rows = await limited.ctx.db.select().from(rateLimit);

			expect(rows).toEqual([expect.objectContaining({ count: 2 })]);
		} finally {
			await limited.close();
		}
	});
});
