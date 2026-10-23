import { loaderReleaseSchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import type { PublishLoaderReleaseRequest } from '@unbound-app/contracts/loader';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { MAX_UPDATE_CHANGELOGS } from '@unbound-app/contracts/updates';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import withdrawLoaderReleaseEndpoint from '~/endpoints/withdraw-loader-release';
import publishLoaderReleaseEndpoint from '~/endpoints/publish-loader-release';
import checkLoaderUpdateEndpoint from '~/endpoints/check-loader-update';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';

type LoaderQuery = Record<string, string>;

const NOW = new Date('2026-10-17T12:00:00.000Z');

const base = createTestContext();
let clock = NOW;
const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(base.close);

let users = 0;
let admin = new Headers();
let member = new Headers();

async function apiKeyHeaders(role: Role): Promise<Headers> {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022467${String(users).padStart(4, '0')}`,
		name: `CI ${users}`,
		email: `ci-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const created = await authRequest(ctx, '/api-key/create', {
		method: 'POST',
		headers,
		body: JSON.stringify({ name: 'ci' }),
	});
	const { key } = await created.json();

	return new Headers({ [API_KEY_HEADER]: key });
}

function release(
	platform: PublishLoaderReleaseRequest['platform'],
	version: string,
): Required<PublishLoaderReleaseRequest> {
	return {
		platform,
		version,
		url: `https://github.com/unbound-app/loader/releases/tag/${platform}-${version}`,
		changelog: `Changes in ${version}.`,
	};
}

function publish(headers: Headers, body: PublishLoaderReleaseRequest) {
	return publishLoaderReleaseEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/loader/releases', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

function withdraw(headers: Headers, platform: string, version: string) {
	return withdrawLoaderReleaseEndpoint.handle(
		ctx,
		new Request(new URL(`/api/v1/loader/releases/${platform}/${version}`, ctx.env.PUBLIC_URL), {
			method: 'DELETE',
			headers,
		}),
		{ platform, version },
	);
}

function check(query: LoaderQuery, target: AppContext = ctx, ip: string = '203.0.113.1') {
	const url = new URL('/api/v1/loader/updates', target.env.PUBLIC_URL);

	url.search = new URLSearchParams(query).toString();

	return checkLoaderUpdateEndpoint.handle(
		target,
		new Request(url, { headers: { [target.env.IP_ADDRESS_HEADER]: ip } }),
	);
}

async function updateFor(platform: string, version: string) {
	const response = await check({ platform, version });

	expect(response.status).toBe(200);

	return loaderUpdateResponseSchema.parse(await response.json()).update;
}

async function refused(response: Response) {
	const { error } = apiErrorResponseSchema.parse(await response.json());

	return { status: response.status, code: error.code };
}

beforeAll(async () => {
	admin = await apiKeyHeaders('admin');
	member = await apiKeyHeaders('moderator');

	const published = [
		...['1.0.0', '1.1.0', '1.10.0', '2.0.0-beta.1'].map((version) => release('ios', version)),
		...Array.from({ length: MAX_UPDATE_CHANGELOGS + 5 }, (_, index) =>
			release('android', `1.${index + 1}.0`),
		),
	];

	for (const body of published) {
		expect((await publish(admin, body)).status).toBe(200);
	}
});

describe('POST /api/v1/loader/releases', () => {
	test('refuses anonymous callers and callers without loader publishing', async () => {
		expect(await refused(await publish(new Headers(), release('ios', '9.0.0')))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
		expect(await refused(await publish(member, release('ios', '9.0.0')))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await updateFor('ios', '2.0.0-beta.1')).toBeNull();
	});

	test('publishing a version again replaces its url and changelog but keeps when it was first published', async () => {
		const first = release('ios', '3.0.0');
		const again = { ...first, url: 'https://example.com/unbound-3.0.0.ipa', changelog: null };

		try {
			const created = loaderReleaseSchema.parse(await (await publish(admin, first)).json());

			clock = new Date(NOW.getTime() + 60_000);

			const replaced = loaderReleaseSchema.parse(await (await publish(admin, again)).json());

			expect(created.publishedAt).toBe(NOW.toISOString());
			expect(replaced).toEqual({ ...again, publishedAt: NOW.toISOString() });
			expect((await updateFor('ios', '1.10.0'))?.changelogs).toEqual([
				{ version: '3.0.0', changelog: null, publishedAt: NOW.toISOString() },
			]);
		} finally {
			clock = NOW;
			await withdraw(admin, 'ios', '3.0.0');
		}
	});
});

describe('DELETE /api/v1/loader/releases/$platform/$version', () => {
	test('withdraws a release so it is no longer offered', async () => {
		await publish(admin, release('ios', '4.0.0'));

		expect((await updateFor('ios', '1.10.0'))?.version).toBe('4.0.0');

		const response = await withdraw(admin, 'ios', '4.0.0');

		expect(response.status).toBe(200);
		expect(loaderReleaseSchema.parse(await response.json()).version).toBe('4.0.0');
		expect(await updateFor('ios', '1.10.0')).toBeNull();
		expect(await refused(await withdraw(admin, 'ios', '4.0.0'))).toEqual({
			status: 404,
			code: 'not_found',
		});
	});

	test('refuses callers without loader publishing and malformed path segments', async () => {
		expect(await refused(await withdraw(new Headers(), 'ios', '1.0.0'))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
		expect(await refused(await withdraw(member, 'ios', '1.0.0'))).toEqual({
			status: 403,
			code: 'forbidden',
		});

		for (const [platform, version] of [
			['windows', '1.0.0'],
			['ios', 'latest'],
		] as const) {
			expect(await refused(await withdraw(admin, platform, version))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		}

		expect((await updateFor('ios', '0.9.0'))?.version).toBe('1.10.0');
	});
});

describe('GET /api/v1/loader/updates', () => {
	test('offers the newest newer release by semver, with the changelogs it skips over', async () => {
		const offered = release('ios', '1.10.0');

		expect(await updateFor('ios', '1.0.0')).toEqual({
			...offered,
			publishedAt: NOW.toISOString(),
			changelogs: ['1.10.0', '1.1.0'].map((version) => ({
				version,
				changelog: `Changes in ${version}.`,
				publishedAt: NOW.toISOString(),
			})),
		});
	});

	test('answers null for a current or newer install', async () => {
		expect(await updateFor('ios', '1.10.0')).toBeNull();
		expect(await updateFor('ios', '9.0.0')).toBeNull();
	});

	test("offers only the installed platform's releases", async () => {
		const update = await updateFor('android', `1.${MAX_UPDATE_CHANGELOGS + 4}.0`);

		expect(update?.platform).toBe('android');
		expect(update?.changelogs.map((entry) => entry.version)).toEqual([
			`1.${MAX_UPDATE_CHANGELOGS + 5}.0`,
		]);
	});

	test('caps the changelogs at MAX_UPDATE_CHANGELOGS, newest first', async () => {
		const update = await updateFor('android', '1.0.0');

		expect(update?.version).toBe(`1.${MAX_UPDATE_CHANGELOGS + 5}.0`);
		expect(update?.changelogs.map((entry) => entry.version)).toEqual(
			Array.from(
				{ length: MAX_UPDATE_CHANGELOGS },
				(_, index) => `1.${MAX_UPDATE_CHANGELOGS + 5 - index}.0`,
			),
		);
	});

	test('offers a prerelease only to a prerelease install', async () => {
		expect((await updateFor('ios', '1.1.0'))?.version).toBe('1.10.0');
		expect((await updateFor('ios', '1.11.0-alpha.1'))?.version).toBe('2.0.0-beta.1');

		const fromAlpha = await updateFor('ios', '2.0.0-alpha.1');

		expect(fromAlpha?.version).toBe('2.0.0-beta.1');
		expect(fromAlpha?.changelogs.map((entry) => entry.version)).toEqual(['2.0.0-beta.1']);
	});

	test('rejects a missing, unknown or malformed query with invalid_request', async () => {
		const queries: LoaderQuery[] = [
			{},
			{ platform: 'ios' },
			{ platform: 'windows', version: '1.0.0' },
			{ platform: 'ios', version: 'dev' },
		];

		for (const query of queries) {
			expect(await refused(await check(query))).toEqual({
				status: 400,
				code: 'invalid_request',
			});
		}
	});

	test('rate limits each client IP within UPDATES_RATE_LIMIT_WINDOW_SECONDS', async () => {
		const limited = createTestContext({ UPDATES_RATE_LIMIT_MAX: '1' });
		const target: AppContext = { ...limited.ctx, now: () => NOW };
		const query = { platform: 'ios', version: '1.0.0' };

		try {
			expect((await check(query, target)).status).toBe(200);
			expect(await refused(await check(query, target))).toEqual({
				status: 429,
				code: 'rate_limited',
			});
			expect((await check(query, target, '203.0.113.2')).status).toBe(200);
		} finally {
			limited.close();
		}
	});
});
