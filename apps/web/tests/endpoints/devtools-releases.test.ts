import {
	devtoolsReleaseSchema,
	devtoolsUpdateResponseSchema,
} from '@unbound-app/contracts/devtools';
import type {
	DevtoolsTarget,
	PublishDevtoolsReleaseRequest,
} from '@unbound-app/contracts/devtools';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import publishDevtoolsReleaseEndpoint from '~/endpoints/publish-devtools-release';
import checkDevtoolsUpdateEndpoint from '~/endpoints/check-devtools-update';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord } from '../helpers/context';

const NOW = new Date('2026-11-13T12:00:00.000Z');

const base = await createTestContext();
let clock = NOW;
const ctx: AppContext = { ...base.ctx, now: () => clock };

afterAll(base.close);

let users = 0;
let ci = new Headers();
let member = new Headers();

async function apiKeyHeaders(role: Role): Promise<Headers> {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022469${String(users).padStart(4, '0')}`,
		name: `CI ${users}`,
		email: `devtools-ci-${users}@example.com`,
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
	version: string,
	targets: DevtoolsTarget[] = ['macos-arm64', 'linux-x64'],
): PublishDevtoolsReleaseRequest {
	return {
		version,
		changelog: `Changes in ${version}.`,
		assets: targets.map((target) => ({
			target,
			url: `https://github.com/marioparaschiv/unbound/releases/download/devtools-v${version}/unbound-devtools-${target}.tar.gz`,
			sha256: 'a'.repeat(64),
		})),
	};
}

// UNKNOWN: the malformed-request tests post bodies outside the request schema on purpose.
function publish(headers: Headers, body: unknown) {
	return publishDevtoolsReleaseEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/devtools/releases', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

async function check(query: Record<string, string>) {
	const url = new URL('/api/v1/devtools/updates', ctx.env.PUBLIC_URL);

	url.search = new URLSearchParams(query).toString();

	return checkDevtoolsUpdateEndpoint.handle(
		ctx,
		new Request(url, { headers: { [ctx.env.IP_ADDRESS_HEADER]: '203.0.113.10' } }),
	);
}

async function update(target: DevtoolsTarget, version: string) {
	const response = await check({ target, version });

	expect(response.status).toBe(200);

	return parse(devtoolsUpdateResponseSchema, await response.json()).update;
}

async function refused(response: Response) {
	const { error } = parse(apiErrorResponseSchema, await response.json());

	return { status: response.status, code: error.code };
}

beforeAll(async () => {
	ci = await apiKeyHeaders('ci');
	member = await apiKeyHeaders('moderator');
});

describe('POST /api/v1/devtools/releases', () => {
	test('refuses anonymous callers and callers without DevTools publishing', async () => {
		expect(await refused(await publish(new Headers(), release('1.0.0')))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
		expect(await refused(await publish(member, release('1.0.0')))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await update('linux-x64', '0.1.0')).toBeNull();
	});

	test('rejects unknown targets and a target listed twice', async () => {
		expect(
			await refused(await publish(ci, release('1.0.0', ['plan9-x64' as DevtoolsTarget]))),
		).toEqual({ status: 400, code: 'invalid_request' });
		expect(
			await refused(await publish(ci, release('1.0.0', ['linux-x64', 'linux-x64']))),
		).toEqual({ status: 400, code: 'invalid_request' });
	});

	test('keeps the first publish time when a version is posted again', async () => {
		const created = parse(
			devtoolsReleaseSchema,
			await (await publish(ci, release('1.0.0'))).json(),
		);

		expect(created.publishedAt).toBe(NOW.toISOString());

		clock = new Date(NOW.getTime() + 60_000);

		try {
			const again = release('1.0.0', ['macos-arm64', 'linux-x64', 'windows-x64']);
			const replaced = parse(devtoolsReleaseSchema, await (await publish(ci, again)).json());

			expect(replaced.publishedAt).toBe(NOW.toISOString());
			expect(replaced.assets.map((asset) => asset.target)).toEqual([
				'macos-arm64',
				'linux-x64',
				'windows-x64',
			]);
		} finally {
			clock = NOW;
		}
	});
});

describe('GET /api/v1/devtools/updates', () => {
	test("offers the newest release built for the target with that target's archive", async () => {
		await publish(ci, release('1.1.0'));
		await publish(ci, release('1.2.0', ['macos-arm64']));

		const linux = await update('linux-x64', '1.0.0');

		expect(linux?.version).toBe('1.1.0');
		expect(linux?.url).toEndWith('/devtools-v1.1.0/unbound-devtools-linux-x64.tar.gz');
		expect(linux?.changelogs.map((entry) => entry.version)).toEqual(['1.1.0']);

		const mac = await update('macos-arm64', '1.0.0');

		expect(mac?.version).toBe('1.2.0');
		expect(mac?.changelogs.map((entry) => entry.version)).toEqual(['1.2.0', '1.1.0']);
		expect(await update('macos-arm64', '1.2.0')).toBeNull();
	});

	test('offers prereleases only to a prerelease install', async () => {
		await publish(ci, release('1.3.0-beta.1'));

		expect(await update('linux-x64', '1.1.0')).toBeNull();
		expect((await update('linux-x64', '1.1.0-beta.1'))?.version).toBe('1.3.0-beta.1');
	});

	test('rejects unknown targets and malformed versions', async () => {
		expect(await refused(await check({ target: 'plan9-x64', version: '1.0.0' }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await refused(await check({ target: 'linux-x64', version: 'latest' }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});
});
