import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { readAddonSource } from '~/lib/addon-source';
import { publish, type PublishPin } from '~/lib/publish-version';
import type { Caller } from '~/lib/api/caller';
import { connectGitHubIfLinked } from '~/lib/github';
import { user } from '~/db/schema';

import { createTestContext, signInWithDiscord, snowflakeAt } from '../helpers/context';
import { commitPlugin, serveGitHub } from '../helpers/github';
import { serveMemoryS3 } from '../helpers/memory-s3';
import { rejection } from '../helpers/server';
import { manifest } from '../helpers/addons';

const REPOSITORY = 'unbound-app/unbound';

const s3 = serveMemoryS3();
const github = serveGitHub({ repositories: { [REPOSITORY]: {} }, tokens: {} });

// Refuses every write while `failing`, as a storage outage after the version committed would.
let failing = false;
const flaky = Bun.serve({
	port: 0,
	fetch(request) {
		if (failing && request.method === 'PUT') {
			return new Response(null, { status: 503 });
		}

		return fetch(new URL(new URL(request.url).pathname, s3.url), request);
	},
});

const { ctx, close } = await createTestContext({
	S3_ENDPOINT: flaky.url.href,
	GITHUB_API_URL: github.url.href,
	FIRST_PARTY_REPOSITORY: REPOSITORY,
});

afterAll(async () => {
	await Promise.all([flaky.stop(true), s3.stop(true), github.stop()]);
	await close();
});

async function signUpCi(): Promise<Caller> {
	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: 'CI',
		email: 'ci@example.com',
	});

	await ctx.db.update(user).set({ role: 'ci' }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'api-key' };
}

async function readBuild(caller: Caller, id: string) {
	const compiled = new TextEncoder().encode(`${id} bytecode 98`);
	const { request } = commitPlugin(github.repository(REPOSITORY), REPOSITORY, id, '1.0.0', {
		'manifest.json': JSON.stringify({
			...manifest(id),
			main: 'src/index.ts',
			bytecode: { '98': new Bun.CryptoHasher('sha512').update(compiled).digest('hex') },
		}),
		'dist/index.98.hbc': compiled,
	});
	const client = await connectGitHubIfLinked(ctx, caller.user.id);

	return readAddonSource(ctx, client, request, false);
}

function pendingSince(addonId: string) {
	return ctx.db.query.addonVersion
		.findFirst({ where: { addonId, version: '1.0.0' } })
		.then((row) => row?.filesPendingSince);
}

describe('first-party publishing', () => {
	test('commits the version before its files, and a repeated publish writes what a failed write left', async () => {
		const caller = await signUpCi();
		const source = await readBuild(caller, 'publish.recover');
		const pin: PublishPin = { mode: 'first-party', source, caller, repository: REPOSITORY };

		failing = true;

		try {
			expect(await rejection(publish(ctx, pin))).toBeInstanceOf(Error);
		} finally {
			failing = false;
		}

		expect(await pendingSince('publish.recover')).toBeInstanceOf(Date);

		expect(await publish(ctx, pin)).toMatchObject({
			status: 'unchanged',
			sha256: source.sha256,
		});
		expect(await pendingSince('publish.recover')).toBeNull();
		expect(
			await ctx.storage.public.file('addons/publish.recover/1.0.0/index.98.hbc').exists(),
		).toBe(true);
		expect(await ctx.storage.public.file('addons/publish.recover/1.0.0/index.js').text()).toBe(
			new TextDecoder().decode(source.bundle),
		);
	});
});
