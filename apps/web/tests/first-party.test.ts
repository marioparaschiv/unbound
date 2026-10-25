import {
	listFirstPartyAddonsResponseSchema,
	publishFirstPartyResponseSchema,
} from '@unbound-app/contracts/publish';
import type { PublishFirstPartyRequest } from '@unbound-app/contracts/publish';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { eq } from 'drizzle-orm';

import listFirstPartyAddonsEndpoint from '~/endpoints/list-first-party-addons';
import publishFirstPartyEndpoint from '~/endpoints/publish-first-party';
import { API_KEY_HEADER, createApiClient } from '~/api/client';
import getCatalogEndpoint from '~/endpoints/get-catalog';
import { createSubmission } from '~/lib/submissions';
import { getArtifactKeys } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import { reviewSubmission } from '~/lib/review';
import type { Caller } from '~/lib/api/caller';
import { delistAddon } from '~/lib/addons';
import { addon, user } from '~/db/schema';
import type { Api } from '~/api';

import type { GitFixture } from './helpers/github';

import {
	authRequest,
	createTestContext,
	linkGitHub,
	signInWithDiscord,
	snowflakeAt,
} from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';
import { failure, serveEndpoints } from './helpers/server';
import { serveMemoryS3 } from './helpers/memory-s3';
import { serveGitHub } from './helpers/github';

type Member = {
	userId: string;
	session: Headers;
	caller: Caller;
};

const FIRST_PARTY = 'unbound-app/unbound';
const THIRD_PARTY = 'acme/addons';

const s3 = serveMemoryS3();
const reviewS3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [FIRST_PARTY]: {}, [THIRD_PARTY]: {} },
	tokens: { owner: { push: [FIRST_PARTY, THIRD_PARTY] } },
});
const fixture = github.repository(FIRST_PARTY);

const shared = { GITHUB_API_URL: github.url.href, FIRST_PARTY_REPOSITORY: FIRST_PARTY };
const trusted = createTestContext({ ...shared, S3_ENDPOINT: s3.url.href });
const reviewed = createTestContext({ ...shared, S3_ENDPOINT: reviewS3.url.href });
const unconfigured = createTestContext({ GITHUB_API_URL: github.url.href });
const ctx = trusted.ctx;

const server = serveEndpoints(ctx, {
	'POST /api/v1/first-party/publish': publishFirstPartyEndpoint,
	'GET /api/v1/catalog': getCatalogEndpoint,
	'GET /api/v1/first-party/addons': listFirstPartyAddonsEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await Promise.all([server.stop(true), s3.stop(true), reviewS3.stop(true), github.stop()]);

	for (const context of [trusted, reviewed, unconfigured]) {
		context.close();
	}
});

let users = 0;

async function signUp(target: AppContext, role: string = 'user'): Promise<Member> {
	users += 1;

	const { userId, headers } = await signInWithDiscord(target, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `first-party-${users}@example.com`,
	});

	await target.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await target.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { userId, session: headers, caller: { user: row, via: 'session' } };
}

async function apiKey(target: AppContext, member: Member): Promise<Headers> {
	const created = await authRequest(target, '/api-key/create', {
		method: 'POST',
		headers: member.session,
		body: JSON.stringify({ name: 'ci' }),
	});
	const { key } = await created.json();

	return new Headers({ [API_KEY_HEADER]: key });
}

/** Commits the plugin's source to main, then its build output on a commit tagged `plugin-builds/<main sha>`. */
function buildTag(
	target: GitFixture,
	id: string,
	version: string = '1.0.0',
	repository: string = FIRST_PARTY,
): PublishFirstPartyRequest {
	const path = `plugins/${id}`;
	const main = target.commit({
		'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
		[`${path}/manifest.json`]: JSON.stringify({
			...manifest(id, version),
			main: 'src/index.ts',
		}),
		[`${path}/package.json`]: JSON.stringify({ scripts: { build: 'bun build' } }),
	});
	const build = target.commit(
		{
			[`${path}/dist/index.js`]: `export default '${id} ${version}';`,
			[`${path}/CHANGELOG.md`]: `## [${version}]\n\n### Added\n\n- Hello.\n`,
		},
		{ branch: null, parent: main },
	);
	const ref = `plugin-builds/${main}`;

	target.tag(ref, { at: build });

	return { repository, path, ref, commitSha: build };
}

function publish(headers: Headers, body: PublishFirstPartyRequest) {
	return client('POST /api/v1/first-party/publish', {
		headers,
		body,
		response: publishFirstPartyResponseSchema,
	});
}

function publishTo(target: AppContext, headers: Headers, body: PublishFirstPartyRequest) {
	return publishFirstPartyEndpoint.handle(
		target,
		new Request(new URL('/api/v1/first-party/publish', target.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

function readPublic(target: AppContext, id: string, version: string) {
	const keys = getArtifactKeys(id, version, 'index.js');

	return Promise.all([
		target.storage.public.file(keys.bundle).bytes(),
		target.storage.public.file(keys.manifest).bytes(),
	]);
}

function liveSha256(target: AppContext, id: string, version: string) {
	return target.db.query.addonVersion
		.findFirst({ where: { addonId: id, version } })
		.then((row) => row?.sha256);
}

async function countWrites(id: string) {
	const [submissions, events] = await Promise.all([
		ctx.db.query.submission.findMany({ where: { addonId: id } }),
		ctx.db.query.moderationEvent.findMany({ where: { subjectId: id } }),
	]);

	return [submissions.length, events.length];
}

let ci: Member;
let ciKey = new Headers();

beforeAll(async () => {
	ci = await signUp(ctx, 'ci');
	ciKey = await apiKey(ctx, ci);
});

describe('POST /api/v1/first-party/publish', () => {
	test('publishes a new listing and then an update from build tags, without review', async () => {
		const listing = await publish(ciKey, buildTag(fixture, 'fp.hello'));

		expect(listing).toMatchObject({
			status: 'published',
			addonId: 'fp.hello',
			version: '1.0.0',
		});

		const update = await publish(ciKey, buildTag(fixture, 'fp.hello', '1.1.0'));

		expect(update).toMatchObject({ status: 'published', version: '1.1.0' });

		const { addons } = await client('GET /api/v1/catalog', { response: catalogResponseSchema });
		const live = addons.find((entry) => entry.id === 'fp.hello');

		expect(live?.latestVersion).toMatchObject({
			version: '1.1.0',
			sha256: update.sha256,
			source: { repository: FIRST_PARTY },
		});

		const [bundle] = await readPublic(ctx, 'fp.hello', '1.1.0');

		expect(new TextDecoder().decode(bundle)).toBe(`export default 'fp.hello 1.1.0';`);

		const submissions = await ctx.db.query.submission.findMany({
			where: { addonId: 'fp.hello' },
			orderBy: { createdAt: 'asc' },
		});

		expect(submissions.map(({ kind, status }) => [kind, status])).toEqual([
			['listing', 'approved'],
			['update', 'approved'],
		]);

		const events = await ctx.db.query.moderationEvent.findMany({
			where: { subjectId: 'fp.hello', kind: 'review.decided' },
		});

		expect(events.map((event) => event.actorId)).toEqual([ci.userId, ci.userId]);
		expect((await ctx.db.query.user.findFirst({ where: { id: ci.userId } }))?.role).toBe('ci');
	});

	test('publishing the same version again answers unchanged and writes nothing', async () => {
		const request = buildTag(fixture, 'fp.again');
		const first = await publish(ciKey, request);
		const keys = getArtifactKeys('fp.again', '1.0.0', 'index.js');
		const before = await countWrites('fp.again');

		await ctx.storage.public.delete(keys.bundle);

		const again = await publish(ciKey, request);
		const rebuilt = await publish(ciKey, buildTag(fixture, 'fp.again'));

		expect(again).toEqual({ ...first, status: 'unchanged' });
		expect(rebuilt).toEqual({ ...first, status: 'unchanged' });
		expect(await ctx.storage.public.file(keys.bundle).exists()).toBe(false);
		expect(await countWrites('fp.again')).toEqual(before);
		expect(before).toEqual([1, 1]);
	});

	test('publishes the same bytes a reviewed approval of the same commit does', async () => {
		const request = buildTag(fixture, 'fp.same');
		const trustedResult = await publish(ciKey, request);

		const author = await signUp(reviewed.ctx);
		const moderator = await signUp(reviewed.ctx, 'moderator');

		await linkGitHub(reviewed.ctx, author.userId, 'owner');

		const { submission } = await createSubmission(reviewed.ctx, author.caller, request);

		await reviewSubmission(reviewed.ctx, moderator.caller, submission.id, {
			decision: 'approved',
		});

		expect(await readPublic(ctx, 'fp.same', '1.0.0')).toEqual(
			await readPublic(reviewed.ctx, 'fp.same', '1.0.0'),
		);
		expect(trustedResult.sha256).toBe(
			(await liveSha256(reviewed.ctx, 'fp.same', '1.0.0')) ?? '',
		);
		expect(await liveSha256(ctx, 'fp.same', '1.0.0')).toBe(trustedResult.sha256);
	});
});

describe('GET /api/v1/first-party/addons', () => {
	test('lists a delisted first-party addon at its newest version, and no other repository', async () => {
		const request = buildTag(fixture, 'fp.delisted');
		const admin = await signUp(ctx, 'admin');
		const owner = await signUp(ctx);

		await publish(ciKey, request);
		delistAddon(ctx, admin.caller, 'fp.delisted');
		await seedApprovedAddon(ctx, owner.userId, manifest('fp.elsewhere'));
		await ctx.db
			.update(addon)
			.set({ repository: THIRD_PARTY })
			.where(eq(addon.id, 'fp.elsewhere'));

		const { addons } = await client('GET /api/v1/first-party/addons', {
			headers: ciKey,
			response: listFirstPartyAddonsResponseSchema,
		});

		expect(addons).toContainEqual({
			id: 'fp.delisted',
			version: '1.0.0',
			commitSha: request.commitSha,
		});
		expect(addons.map(({ id }) => id)).not.toContain('fp.elsewhere');
	});

	test('needs the same credential as publishing', async () => {
		const developer = await signUp(ctx, 'developer');

		for (const headers of [ci.session, await apiKey(ctx, developer)]) {
			expect(
				await failure(
					client('GET /api/v1/first-party/addons', {
						headers,
						response: listFirstPartyAddonsResponseSchema,
					}),
				),
			).toEqual({ status: 403, code: 'forbidden' });
		}
	});
});

describe('refusals', () => {
	test('a session, even a ci one, and a key without first-party publishing are forbidden', async () => {
		const developer = await signUp(ctx, 'developer');
		const request = buildTag(fixture, 'fp.denied');

		expect(await failure(publish(ci.session, request))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await failure(publish(await apiKey(ctx, developer), request))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await failure(publish(new Headers(), request))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
	});

	test('another repository, or no configured repository, is forbidden', async () => {
		const foreign = buildTag(
			github.repository(THIRD_PARTY),
			'fp.foreign',
			'1.0.0',
			THIRD_PARTY,
		);
		const member = await signUp(unconfigured.ctx, 'ci');
		const response = await publishTo(
			unconfigured.ctx,
			await apiKey(unconfigured.ctx, member),
			buildTag(fixture, 'fp.unconfigured'),
		);

		expect(await failure(publish(ciKey, foreign))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(response.status).toBe(403);
		expect((await response.json()).error.code).toBe('forbidden');
	});

	test('a branch or tag other than a build tag is forbidden', async () => {
		const request = buildTag(fixture, 'fp.branch');

		fixture.tag('release', { at: request.commitSha });

		expect(await failure(publish(ciKey, { ...request, ref: 'release' }))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await liveSha256(ctx, 'fp.branch', '1.0.0')).toBeUndefined();
	});

	test('an addon published from another repository is never taken over', async () => {
		const owner = await signUp(ctx);

		await seedApprovedAddon(ctx, owner.userId, manifest('fp.taken'));
		await ctx.db.update(addon).set({ repository: THIRD_PARTY }).where(eq(addon.id, 'fp.taken'));

		expect(await failure(publish(ciKey, buildTag(fixture, 'fp.taken', '2.0.0')))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await liveSha256(ctx, 'fp.taken', '2.0.0')).toBeUndefined();
	});

	test("another user's open listing keeps its addon id", async () => {
		const author = await signUp(ctx);

		await seedSubmission(ctx, author.userId, manifest('fp.claimed'));

		expect(await failure(publish(ciKey, buildTag(fixture, 'fp.claimed')))).toEqual({
			status: 409,
			code: 'addon_id_taken',
		});
	});

	test("a ci account's ordinary submission still waits for review", async () => {
		const member = await signUp(ctx, 'ci,user');

		await linkGitHub(ctx, member.userId, 'owner');

		const { submission } = await createSubmission(
			ctx,
			{ ...member.caller, via: 'api-key' },
			buildTag(fixture, 'fp.queued'),
		);

		expect(submission.status).toBe('pending_review');
		expect(await liveSha256(ctx, 'fp.queued', '1.0.0')).toBeUndefined();
	});
});
