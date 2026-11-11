import { bundleReleaseSchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import type { PublishBundleReleaseRequest } from '@unbound-app/contracts/loader';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import publishBundleReleaseEndpoint from '~/endpoints/publish-bundle-release';
import checkLoaderUpdateEndpoint from '~/endpoints/check-loader-update';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord } from '../helpers/context';

const NOW = new Date('2026-10-17T12:00:00.000Z');

const base = await createTestContext();
let clock = NOW;
const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(base.close);

let users = 0;
let admin = new Headers();
let member = new Headers();

async function apiKeyHeaders(role: Role): Promise<Headers> {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022468${String(users).padStart(4, '0')}`,
		name: `CI ${users}`,
		email: `bundle-ci-${users}@example.com`,
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

function publish(headers: Headers, body: PublishBundleReleaseRequest) {
	return publishBundleReleaseEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/loader/bundles', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

async function publishAt(minutes: number, body: PublishBundleReleaseRequest) {
	clock = new Date(NOW.getTime() + minutes * 60_000);

	try {
		expect((await publish(admin, body)).status).toBe(200);
	} finally {
		clock = NOW;
	}
}

async function requiredFor(version: string, channel?: string) {
	const url = new URL('/api/v1/loader/updates', ctx.env.PUBLIC_URL);

	url.search = new URLSearchParams({
		platform: 'ios',
		version,
		...(channel ? { channel } : {}),
	}).toString();

	const response = await checkLoaderUpdateEndpoint.handle(
		ctx,
		new Request(url, { headers: { [ctx.env.IP_ADDRESS_HEADER]: '203.0.113.9' } }),
	);

	expect(response.status).toBe(200);

	return parse(loaderUpdateResponseSchema, await response.json()).requiredVersion;
}

beforeAll(async () => {
	admin = await apiKeyHeaders('admin');
	member = await apiKeyHeaders('moderator');
});

describe('POST /api/v1/loader/bundles', () => {
	test('refuses anonymous callers and callers without loader publishing', async () => {
		const body = { channel: 'stable', version: '0.1.0', minLoaderVersion: '9.0.0' } as const;

		expect((await publish(new Headers(), body)).status).toBe(401);
		expect((await publish(member, body)).status).toBe(403);
		expect(await requiredFor('1.0.0', 'stable')).toBeNull();
	});

	test('publishing a version again replaces its requirement but keeps when it was first published', async () => {
		await publishAt(0, { channel: 'beta', version: 'abc1234', minLoaderVersion: '1.0.0' });

		const again = { channel: 'beta', version: 'abc1234', minLoaderVersion: '1.2.0' } as const;

		clock = new Date(NOW.getTime() + 60_000);

		try {
			const replaced = parse(bundleReleaseSchema, await (await publish(admin, again)).json());

			expect(replaced).toEqual({ ...again, publishedAt: NOW.toISOString() });
		} finally {
			clock = NOW;
		}
	});
});

describe('GET /api/v1/loader/updates requiredVersion', () => {
	test("names the loader the channel's newest bundle needs when the installed one is older", async () => {
		await publishAt(10, { channel: 'stable', version: '1.0.0', minLoaderVersion: '1.1.0' });
		await publishAt(20, { channel: 'stable', version: '1.1.0', minLoaderVersion: '1.3.0' });

		expect(await requiredFor('1.2.0', 'stable')).toBe('1.3.0');
		expect(await requiredFor('1.3.0', 'stable')).toBeNull();
		expect(await requiredFor('2.0.0', 'stable')).toBeNull();
	});

	test('answers null without a channel', async () => {
		expect(await requiredFor('0.1.0')).toBeNull();
	});
});
