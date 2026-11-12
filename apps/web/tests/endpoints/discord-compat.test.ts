import { publishDiscordCompatResponseSchema } from '@unbound-app/contracts/discord-compat';
import type { PublishDiscordCompatRequest } from '@unbound-app/contracts/discord-compat';
import { debugCardResponseSchema } from '@unbound-app/contracts/debug-cards';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import publishDiscordCompatEndpoint from '~/endpoints/publish-discord-compat';
import renderDebugCardEndpoint from '~/endpoints/render-debug-card';
import { findDiscordCompat } from '~/lib/discord-compat';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { authRequest, createTestContext, signInWithDiscord } from '../helpers/context';

const base = await createTestContext();
const ctx: AppContext = base.ctx;

afterAll(base.close);

let users = 0;
let admin = new Headers();
let member = new Headers();

async function apiKeyHeaders(role: Role): Promise<Headers> {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022469${String(users).padStart(4, '0')}`,
		name: `Compat CI ${users}`,
		email: `compat-ci-${users}@example.com`,
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

function publish(headers: Headers, body: PublishDiscordCompatRequest) {
	return publishDiscordCompatEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/loader/compat', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

const scan: PublishDiscordCompatRequest = {
	channel: 'alpha',
	scans: [
		{ platform: 'ios', version: '355.0', build: '122874', broken: 2, fallbacks: 5 },
		{ platform: 'android', version: '355.0', broken: 0, fallbacks: 1 },
	],
};

beforeAll(async () => {
	admin = await apiKeyHeaders('admin');
	member = await apiKeyHeaders('moderator');
});

describe('POST /api/v1/loader/compat', () => {
	test('refuses anonymous callers and callers without loader publishing', async () => {
		expect((await publish(new Headers(), scan)).status).toBe(401);
		expect((await publish(member, scan)).status).toBe(403);
	});

	test('records each scanned build and replaces an earlier scan of it', async () => {
		const response = await publish(admin, scan);

		expect(response.status).toBe(200);
		expect(parse(publishDiscordCompatResponseSchema, await response.json()).recorded).toBe(2);
		expect(await findDiscordCompat(ctx, 'ios', '355.0')).toEqual({ broken: 2, fallbacks: 5 });

		await publish(admin, { channel: 'alpha', scans: [{ ...scan.scans[0]!, broken: 0 }] });

		expect(await findDiscordCompat(ctx, 'ios', '355.0')).toEqual({ broken: 0, fallbacks: 5 });
	});

	test('marks a scanned Discord build on the debug card', async () => {
		await publish(admin, {
			channel: 'alpha',
			scans: [{ platform: 'android', version: '356.0', broken: 3, fallbacks: 0 }],
		});

		const response = await renderDebugCardEndpoint.handle(
			ctx,
			new Request(new URL('/api/v1/debug-cards', ctx.env.PUBLIC_URL), {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					[ctx.env.IP_ADDRESS_HEADER]: '203.0.113.40',
				},
				body: JSON.stringify({
					client: 'v3.0.0',
					commit: 'abc1234',
					loader: '1.3.0',
					loaderOrigin: 'module',
					framework: 'Vector 2.2',
					discord: '356.0',
					discordChannel: 'Alpha',
					discordBuild: '123500',
					discordSupport: 'untested',
					appSource: 'Play Store',
					react: '19.2.3',
					reactNative: '0.86.0',
					hermes: '250829098.0.15',
					bytecode: '98',
					platform: 'Android',
					os: '15 (SDK 35)',
					device: 'Pixel 9',
					flags: ['Stock', 'verified build'],
				}),
			}),
		);
		const card = parse(debugCardResponseSchema, await response.json());

		expect(JSON.parse(card.altText).support).toBe('broken');
	});
});
