import {
	androidBuildSchema,
	androidBuildsResponseSchema,
	MAX_ANDROID_BUILDS,
} from '@unbound-app/contracts/android-builds';
import type { PublishAndroidBuildRequest } from '@unbound-app/contracts/android-builds';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { getCdnUrl } from '@unbound-app/contracts/version-layout';
import { parse } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import publishAndroidBuildEndpoint from '~/endpoints/publish-android-build';
import listAndroidBuildsEndpoint from '~/endpoints/list-android-builds';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';

const NOW = new Date('2026-11-05T12:00:00.000Z');

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
		email: `android-ci-${users}@example.com`,
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

function build(
	channel: PublishAndroidBuildRequest['channel'],
	discordVersionCode: number,
	commit: string,
): PublishAndroidBuildRequest {
	const prefix = `android/${channel}/${discordVersionCode}/${commit}`;
	const version = `${Math.floor(discordVersionCode / 1000)}.${discordVersionCode % 1000}`;

	return {
		channel,
		discordVersion: version,
		discordVersionCode,
		commit,
		splits: ['base', 'config.arm64_v8a'].map((name) => ({
			name,
			sha256: commit.slice(0, 32).repeat(2),
			size: 1000,
			compressedSize: 600,
			key: `${prefix}/${name}.apk.gz`,
		})),
	};
}

// UNKNOWN: the malformed-request tests post bodies outside the request schema on purpose.
function publish(headers: Headers, body: unknown) {
	return publishAndroidBuildEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/loader/android-builds', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

async function list(channel: string) {
	const url = new URL('/api/v1/loader/android-builds', ctx.env.PUBLIC_URL);

	url.search = new URLSearchParams({ channel }).toString();

	return listAndroidBuildsEndpoint.handle(
		ctx,
		new Request(url, { headers: { [ctx.env.IP_ADDRESS_HEADER]: '203.0.113.9' } }),
	);
}

async function builds(channel: string) {
	const response = await list(channel);

	expect(response.status).toBe(200);

	return parse(androidBuildsResponseSchema, await response.json()).builds;
}

async function refused(response: Response) {
	const { error } = parse(apiErrorResponseSchema, await response.json());

	return { status: response.status, code: error.code };
}

const OLD_LOADER = 'a'.repeat(40);
const NEW_LOADER = 'b'.repeat(40);

beforeAll(async () => {
	admin = await apiKeyHeaders('admin');
	member = await apiKeyHeaders('moderator');
});

describe('POST /api/v1/loader/android-builds', () => {
	test('refuses anonymous callers and callers without loader publishing', async () => {
		expect(
			await refused(await publish(new Headers(), build('stable', 352017, OLD_LOADER))),
		).toEqual({ status: 401, code: 'unauthorized' });
		expect(await refused(await publish(member, build('stable', 352017, OLD_LOADER)))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await builds('stable')).toEqual([]);
	});

	test('rejects split keys outside the android prefix and unknown channels', async () => {
		const outside = build('stable', 352017, OLD_LOADER);

		outside.splits[0]!.key = 'unbound/stable/1.0.0/bundle.js';

		expect(await refused(await publish(admin, outside))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(
			await refused(
				await publish(admin, { ...build('stable', 352017, OLD_LOADER), channel: 'canary' }),
			),
		).toEqual({ status: 400, code: 'invalid_request' });
	});

	test('serves each split from the CDN and keeps the first publish time when a build is posted again', async () => {
		const request = build('beta', 353008, OLD_LOADER);
		const created = parse(androidBuildSchema, await (await publish(admin, request)).json());

		expect(created.splits.map((split) => split.url)).toEqual(
			request.splits.map((split) => getCdnUrl(ctx.env.CDN_URL, split.key)),
		);
		expect(created.publishedAt).toBe(NOW.toISOString());

		clock = new Date(NOW.getTime() + 60_000);

		try {
			const again = { ...request, splits: request.splits.slice(0, 1) };
			const replaced = parse(androidBuildSchema, await (await publish(admin, again)).json());

			expect(replaced.publishedAt).toBe(NOW.toISOString());
			expect(replaced.splits.map((split) => split.name)).toEqual(['base']);
			expect(await builds('beta')).toEqual([replaced]);
		} finally {
			clock = NOW;
		}
	});
});

describe('GET /api/v1/loader/android-builds', () => {
	test("lists only the channel's builds, newest Discord first, then newest loader", async () => {
		clock = new Date(NOW.getTime() + 1_000);
		await publish(admin, build('stable', 351011, OLD_LOADER));
		clock = new Date(NOW.getTime() + 2_000);
		await publish(admin, build('stable', 352017, OLD_LOADER));
		clock = new Date(NOW.getTime() + 3_000);
		await publish(admin, build('stable', 352017, NEW_LOADER));
		clock = NOW;

		const listed = await builds('stable');

		expect(listed.map((entry) => [entry.discordVersionCode, entry.commit])).toEqual([
			[352017, NEW_LOADER],
			[352017, OLD_LOADER],
			[351011, OLD_LOADER],
		]);
		expect(listed.every((entry) => entry.channel === 'stable')).toBe(true);
	});

	test(`returns at most ${MAX_ANDROID_BUILDS} builds and rejects unknown channels`, async () => {
		for (let index = 0; index <= MAX_ANDROID_BUILDS; index++) {
			await publish(admin, build('alpha', 360000 + index, OLD_LOADER));
		}

		const listed = await builds('alpha');

		expect(listed).toHaveLength(MAX_ANDROID_BUILDS);
		expect(listed[0]?.discordVersionCode).toBe(360000 + MAX_ANDROID_BUILDS);
		expect(await refused(await list('canary'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});
});
