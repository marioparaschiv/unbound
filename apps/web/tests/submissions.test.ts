import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import { addonMaintainer, submission, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';
import type { EnvSource } from '~/lib/env';

import {
	authRequest,
	authorizeDevice,
	browserSessionHeaders,
	createTestContext,
	linkGitHub,
	signInWithDiscord,
	snowflakeAt,
} from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { commitPlugin, serveGitHub } from './helpers/github';
import { withMemoryStaging } from './helpers/storage';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const DAY_MS = 86_400_000;
const REPOSITORY = 'acme/addons';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] }, reader: { push: [] } },
});

const fixture = github.repository(REPOSITORY);

async function setup(overrides: EnvSource = {}) {
	const test = await createTestContext({
		GITHUB_API_URL: github.url.href,
		GITHUB_RATE_LIMIT_MAX: '1000',
		...overrides,
	});
	let clock = NOW;
	const { ctx, staging } = withMemoryStaging({ ...test.ctx, now: () => clock });

	return {
		ctx,
		staging,
		close: test.close,
		advance(ms: number) {
			clock = new Date(clock.getTime() + ms);
		},
	};
}

const main = await setup();
const { ctx, staging } = main;

afterAll(async () => {
	await main.close();
	await github.stop();
});

function commitAddon(id: string, version?: string) {
	return commitPlugin(fixture, REPOSITORY, id, version);
}

let users = 0;

async function signUp(
	target: AppContext = ctx,
	token: string | null = 'owner',
	accountAgeDays: number = 365,
) {
	users += 1;

	const signedIn = await signInWithDiscord(target, {
		id: snowflakeAt(new Date(target.now().getTime() - accountAgeDays * DAY_MS)),
		name: `User ${users}`,
		email: `user-${users}@example.com`,
	});

	if (token) {
		await linkGitHub(target, signedIn.userId, token);
	}

	return signedIn;
}

function submit(headers: Headers, request: CreateSubmissionRequest, target: AppContext = ctx) {
	return createSubmissionEndpoint.handle(
		target,
		new Request(new URL('/api/v1/submissions', target.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(request),
		}),
	);
}

async function accepted(response: Response) {
	expect(response.status).toBe(200);

	return createSubmissionResponseSchema.parse(await response.json());
}

async function refused(response: Response) {
	const { error } = apiErrorResponseSchema.parse(await response.json());

	return { status: response.status, code: error.code };
}

function sha256(text: string): string {
	return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

describe('authentication', () => {
	test('accepts a browser session, a device-flow session and an API key', async () => {
		const browser = await signUp();
		const device = await signUp();
		const ci = await signUp();

		const created = await authRequest(ctx, '/api-key/create', {
			method: 'POST',
			headers: ci.headers,
			body: JSON.stringify({ name: 'ci' }),
		});

		const { key } = await created.json();

		const responses = await Promise.all([
			submit(
				await browserSessionHeaders(ctx, browser.token),
				commitAddon('auth.browser').request,
			),
			submit(await authorizeDevice(ctx, device.headers), commitAddon('auth.device').request),
			submit(new Headers({ [API_KEY_HEADER]: key }), commitAddon('auth.api-key').request),
		]);

		expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
	});

	test('rejects an anonymous caller', async () => {
		const response = await submit(new Headers(), commitAddon('auth.anonymous').request);

		expect(await refused(response)).toEqual({ status: 401, code: 'unauthorized' });
	});
});

describe('new listings', () => {
	test('claims the addon id, records the pinned source and stages the commit’s bundle', async () => {
		const { userId, headers } = await signUp();
		const { request, bundle } = commitAddon('listing.claim');
		const result = await accepted(await submit(headers, request));

		expect(result.submission).toEqual({
			id: expect.any(String),
			addonId: 'listing.claim',
			version: '1.0.0',
			kind: 'listing',
			status: 'pending_review',
			source: {
				repository: REPOSITORY,
				repositoryId: expect.any(Number),
				path: 'plugins/listing.claim',
				ref: request.ref,
				commitSha: request.commitSha,
				bundlePath: 'plugins/listing.claim/dist/index.js',
				bundleBlobSha: expect.stringMatching(/^[0-9a-f]{40}$/),
			},
			review: null,
		});

		const row = await ctx.db.query.submission.findFirst({
			where: { id: result.submission.id },
			with: { source: true },
		});

		expect(row).toMatchObject({
			authorId: userId,
			repository: REPOSITORY,
			bundleSize: bundle.length,
			sha256: sha256(bundle),
			submittedAt: NOW,
			manifest: { id: 'listing.claim', main: 'index.js' },
			source: { commitSha: request.commitSha, addonMd: null, changelog: null },
		});
		expect(new TextDecoder().decode(staging.objects.get(row?.stagingKey ?? ''))).toBe(bundle);
	});

	test('refuses an id another user has claimed and deletes what it staged', async () => {
		const first = await signUp();
		const second = await signUp();
		const { request } = commitAddon('listing.taken');

		await accepted(await submit(first.headers, request));

		const staged = staging.objects.size;
		const response = await submit(second.headers, request);

		expect(await refused(response)).toEqual({ status: 409, code: 'addon_id_taken' });
		expect(staging.objects.size).toBe(staged);
	});

	test('releases the id once the claiming submission is rejected', async () => {
		const first = await signUp();
		const second = await signUp();
		const { request } = commitAddon('listing.released');
		const claimed = await accepted(await submit(first.headers, request));

		await ctx.db
			.update(submission)
			.set({ status: 'rejected' })
			.where(eq(submission.id, claimed.submission.id));

		const result = await accepted(await submit(second.headers, request));

		expect(result.submission.kind).toBe('listing');
	});

	test('caps the pending new listings per user', async () => {
		const { headers } = await signUp();

		await accepted(await submit(headers, commitAddon('cap.one').request));
		await accepted(await submit(headers, commitAddon('cap.two').request));

		const response = await submit(headers, commitAddon('cap.three').request);

		expect(await refused(response)).toEqual({ status: 409, code: 'pending_listing_cap' });
	});

	test('two concurrent submissions cannot both take the last pending listing slot', async () => {
		const { headers } = await signUp();

		await accepted(await submit(headers, commitAddon('race.one').request));

		// Both stage before either reserves, so their claim transactions overlap.
		const write = staging.write.bind(staging);
		const bothStaged = Promise.withResolvers<void>();
		let staged = 0;
		const held = spyOn(staging, 'write').mockImplementation(async (...args) => {
			staged += 1;

			if (staged === 2) {
				bothStaged.resolve();
			}

			await bothStaged.promise;

			return write(...args);
		});
		const responses = await Promise.all([
			submit(headers, commitAddon('race.two').request),
			submit(headers, commitAddon('race.three').request),
		]).finally(() => held.mockRestore());
		const outcomes = await Promise.all(
			responses.map(async (response) => (response.ok ? 'created' : refused(response))),
		);

		expect(outcomes).toContainEqual('created');
		expect(outcomes).toContainEqual({ status: 409, code: 'pending_listing_cap' });
	});

	test('rejects a request naming a manifest instead of a source', async () => {
		const { headers } = await signUp();
		const response = await createSubmissionEndpoint.handle(
			ctx,
			new Request(new URL('/api/v1/submissions', ctx.env.PUBLIC_URL), {
				method: 'POST',
				headers,
				body: JSON.stringify({ manifest: manifest('listing.legacy'), bundleSize: 1 }),
			}),
		);

		expect(await refused(response)).toEqual({ status: 400, code: 'invalid_request' });
	});
});

describe('republishing', () => {
	test('supersedes the author’s submission with changes requested and deletes its staged bundle', async () => {
		const { headers } = await signUp();
		const first = await accepted(await submit(headers, commitAddon('republish.one').request));
		const firstKey = `submissions/${first.submission.id}/bundle`;

		await ctx.db
			.update(submission)
			.set({ status: 'changes_requested' })
			.where(eq(submission.id, first.submission.id));

		const second = await accepted(await submit(headers, commitAddon('republish.one').request));
		const replaced = await ctx.db.query.submission.findFirst({
			where: { id: first.submission.id },
		});

		expect(second.submission.id).not.toBe(first.submission.id);
		expect(replaced?.status).toBe('superseded');
		expect(staging.objects.has(firstKey)).toBe(false);
		expect(staging.objects.has(`submissions/${second.submission.id}/bundle`)).toBe(true);
	});
});

describe('account age', () => {
	test('requires a Discord account at least SUBMISSION_MIN_ACCOUNT_AGE_DAYS old', async () => {
		const days = ctx.env.SUBMISSION_MIN_ACCOUNT_AGE_DAYS;
		const young = await signUp(ctx, 'owner', days - 1);
		const old = await signUp(ctx, 'owner', days);

		const response = await submit(young.headers, commitAddon('age.young').request);

		expect(await refused(response)).toEqual({ status: 403, code: 'account_too_new' });
		await accepted(await submit(old.headers, commitAddon('age.old').request));
	});
});

describe('updates', () => {
	test('a user who does not maintain the addon cannot submit an update', async () => {
		const owner = await signUp();
		const stranger = await signUp();

		await seedApprovedAddon(ctx, owner.userId, manifest('update.foreign'));

		const response = await submit(
			stranger.headers,
			commitAddon('update.foreign', '1.1.0').request,
		);

		expect(await refused(response)).toEqual({ status: 403, code: 'not_maintainer' });
	});

	test('allows one pending update per addon across its maintainers', async () => {
		const owner = await signUp();
		const maintainer = await signUp();

		await seedApprovedAddon(ctx, owner.userId, manifest('update.pending'));
		await ctx.db.insert(addonMaintainer).values({
			addonId: 'update.pending',
			userId: maintainer.userId,
			role: 'maintainer',
		});
		await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, maintainer.userId));

		const first = await accepted(
			await submit(owner.headers, commitAddon('update.pending', '1.1.0').request),
		);

		const response = await submit(
			maintainer.headers,
			commitAddon('update.pending', '1.2.0').request,
		);

		expect(first.submission.kind).toBe('update');
		expect(await refused(response)).toEqual({ status: 409, code: 'pending_update_exists' });
	});

	test('refuses a version the addon already has', async () => {
		const owner = await signUp();

		await seedApprovedAddon(ctx, owner.userId, manifest('update.existing'));

		const response = await submit(owner.headers, commitAddon('update.existing').request);

		expect(await refused(response)).toEqual({ status: 409, code: 'version_exists' });
	});
});

describe('the GitHub source', () => {
	test('requires a linked GitHub account', async () => {
		const { headers } = await signUp(ctx, null);
		const response = await submit(headers, commitAddon('source.unlinked').request);

		expect(await refused(response)).toEqual({ status: 403, code: 'github_not_linked' });
	});

	test('requires push access to the repository', async () => {
		const { headers } = await signUp(ctx, 'reader');
		const response = await submit(headers, commitAddon('source.reader').request);

		expect(await refused(response)).toEqual({ status: 403, code: 'github_no_push_access' });
	});

	test('asks the author to link GitHub again when the token was revoked', async () => {
		const { headers } = await signUp(ctx, 'revoked');
		const response = await submit(headers, commitAddon('source.revoked').request);

		expect(await refused(response)).toEqual({ status: 403, code: 'github_not_linked' });
	});

	test('refuses a ref that moved since the preview, staging nothing', async () => {
		const { headers } = await signUp();
		const { request } = commitAddon('source.moved');
		const staged = staging.objects.size;

		fixture.commit({ [`${request.path}/dist/index.js`]: 'moved' }, { branch: request.ref });

		expect(await refused(await submit(headers, request))).toEqual({
			status: 409,
			code: 'source_changed',
		});
		expect(staging.objects.size).toBe(staged);
	});
});

describe('rate limiting', () => {
	test('limits submissions per user within SUBMISSION_RATE_LIMIT_WINDOW_SECONDS', async () => {
		const limited = await setup({
			SUBMISSION_RATE_LIMIT_MAX: '2',
			SUBMISSION_MAX_PENDING_LISTINGS: '10',
		});

		try {
			const { headers } = await signUp(limited.ctx);

			await accepted(await submit(headers, commitAddon('rate.one').request, limited.ctx));
			await accepted(await submit(headers, commitAddon('rate.two').request, limited.ctx));

			const response = await submit(headers, commitAddon('rate.three').request, limited.ctx);

			expect(await refused(response)).toEqual({ status: 429, code: 'rate_limited' });

			limited.advance(limited.ctx.env.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000 + 1);

			await accepted(await submit(headers, commitAddon('rate.three').request, limited.ctx));
		} finally {
			await limited.close();
		}
	});

	test('refusals cost no quota', async () => {
		const limited = await setup({
			SUBMISSION_RATE_LIMIT_MAX: '2',
			SUBMISSION_MAX_PENDING_LISTINGS: '10',
		});

		try {
			const author = await signUp(limited.ctx);
			const other = await signUp(limited.ctx);
			const claimed = commitAddon('quota.claimed');
			const moved = commitAddon('quota.moved');

			fixture.commit(
				{ [`${moved.request.path}/dist/index.js`]: 'moved' },
				{
					branch: moved.request.ref,
				},
			);

			await accepted(await submit(other.headers, claimed.request, limited.ctx));

			const refusals = await Promise.all([
				submit(author.headers, claimed.request, limited.ctx).then(refused),
				submit(author.headers, moved.request, limited.ctx).then(refused),
				submit(
					author.headers,
					{ ...claimed.request, path: 'plugins/none' },
					limited.ctx,
				).then(refused),
			]);

			expect(refusals.map((entry) => entry.code)).toEqual([
				'addon_id_taken',
				'source_changed',
				'addon_not_found',
			]);

			await accepted(
				await submit(author.headers, commitAddon('quota.one').request, limited.ctx),
			);
			await accepted(
				await submit(author.headers, commitAddon('quota.two').request, limited.ctx),
			);
		} finally {
			await limited.close();
		}
	});
});
