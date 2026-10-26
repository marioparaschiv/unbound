import {
	reviewQueueResponseSchema,
	reviewSubmissionResponseSchema,
} from '@unbound-app/contracts/review';
import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { ReviewSubmissionRequest } from '@unbound-app/contracts/review';
import type { SubmissionKind } from '@unbound-app/contracts/publish';
import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import reviewSubmissionEndpoint from '~/endpoints/review-submission';
import { addonMaintainer, submission, user } from '~/db/schema';
import delistAddonEndpoint from '~/endpoints/delist-addon';
import reviewQueueEndpoint from '~/endpoints/review-queue';
import { createApiClient } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import type { Api } from '~/api';

import { S3_TEST_ENV, createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { failure, serveEndpoints } from './helpers/server';
import { manifest } from './helpers/addons';

const REPOSITORY = 'acme/addons';

const CHANGELOG = '## [1.0.0]\n\n### Added\n\n- Hello.\n';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);

// The real clock: MinIO checks presigned URLs against it.
const { ctx, close } = await createTestContext({ ...S3_TEST_ENV, GITHUB_API_URL: github.url.href });

const server = serveEndpoints(ctx, {
	'POST /api/v1/submissions': createSubmissionEndpoint,
	'POST /api/v1/submissions/$id/review': reviewSubmissionEndpoint,
	'GET /api/v1/review/queue': reviewQueueEndpoint,
	'POST /api/v1/addons/$id/delist': delistAddonEndpoint,
});

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);
	const published = await ctx.storage.public.list({ prefix: 'addons/review.' });

	await Promise.all([
		...rows.map((row) => ctx.storage.staging.delete(row.key)),
		...(published.contents ?? []).map((object) => ctx.storage.public.delete(object.key)),
	]);
	await server.stop(true);
	await github.stop();
	await close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Member ${users}`,
		email: `member-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));
	await linkGitHub(ctx, userId, 'owner');

	return { userId, client: createApiClient<Api>({ baseUrl: server.url.href, headers }) };
}

type Member = Awaited<ReturnType<typeof signUp>>;

function sha256(bundle: string): string {
	return new Bun.CryptoHasher('sha256').update(bundle).digest('hex');
}

async function publish(
	author: Member,
	id: string,
	bundle: string,
	version: string = '1.0.0',
	files: Record<string, string> = {},
) {
	const { request } = commitPlugin(fixture, REPOSITORY, id, version, {
		'dist/index.js': bundle,
		'CHANGELOG.md': CHANGELOG.replace('1.0.0', version),
		'ADDON.md': `# ${id} ${version}`,
		...files,
	});
	const created = await author.client('POST /api/v1/submissions', {
		body: request,
		response: createSubmissionResponseSchema,
	});

	return created.submission.id;
}

function review(reviewer: Member, id: string, request: ReviewSubmissionRequest) {
	return reviewer.client('POST /api/v1/submissions/$id/review', {
		params: { id },
		body: request,
		response: reviewSubmissionResponseSchema,
	});
}

function queue(reviewer: Member, kind?: SubmissionKind) {
	return reviewer.client('GET /api/v1/review/queue', {
		query: { kind },
		response: reviewQueueResponseSchema,
	});
}

async function findRow(id: string) {
	const [row] = await ctx.db.select().from(submission).where(eq(submission.id, id));

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	return row;
}

async function getRole(userId: string) {
	const [row] = await ctx.db.select({ role: user.role }).from(user).where(eq(user.id, userId));

	return row?.role;
}

// Approves a first listing, leaving its author the owner of a live 1.0.0.
async function approvedAddon(id: string, bundle: string = 'export default 1;') {
	const author = await signUp();
	const moderator = await signUp('moderator');

	await review(moderator, await publish(author, id, bundle), { decision: 'approved' });

	return { author, moderator };
}

describe('approval', () => {
	test('publishes the commit’s bundle and manifest and makes the version live', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const bundle = 'console.log("approved");';
		const published = manifest('review.approve');
		const id = await publish(author, 'review.approve', bundle);
		const { stagingKey } = await findRow(id);

		const { submission: reviewed } = await review(moderator, id, {
			decision: 'approved',
			note: 'Looks good.',
		});

		const base = 'addons/review.approve/1.0.0';
		const publicBundle = await ctx.storage.public.file(`${base}/index.js`).text();
		const version = await ctx.db.query.addonVersion.findFirst({
			where: { addonId: 'review.approve', version: '1.0.0' },
		});

		expect(reviewed).toMatchObject({
			status: 'approved',
			review: { decision: 'approved', note: 'Looks good.' },
		});
		expect(sha256(publicBundle)).toBe(sha256(bundle));
		expect(await ctx.storage.public.file(`${base}/manifest.json`).json()).toEqual(published);
		expect(version).toMatchObject({ submissionId: id, sha256: sha256(bundle) });
		expect(await ctx.storage.staging.exists(stagingKey)).toBe(false);
		expect((await findRow(id)).reviewerId).toBe(moderator.userId);
		expect(
			await ctx.db.query.addonMaintainer.findFirst({ where: { addonId: 'review.approve' } }),
		).toMatchObject({ userId: author.userId, role: 'owner' });
	});

	test('refuses a staged bundle that no longer matches the submission, publishing nothing', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const id = await publish(author, 'review.tampered', 'original');

		await ctx.storage.staging.write((await findRow(id)).stagingKey, 'replaced');

		expect(await failure(review(moderator, id, { decision: 'approved' }))).toEqual({
			status: 409,
			code: 'artifact_mismatch',
		});
		expect((await findRow(id)).status).toBe('pending_review');
		expect(await ctx.storage.public.exists('addons/review.tampered/1.0.0/index.js')).toBe(
			false,
		);
		expect(
			await ctx.db.query.addonVersion.findFirst({ where: { addonId: 'review.tampered' } }),
		).toBeUndefined();
	});

	test('reads a bundle the staging bucket lost again from its pinned blob', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const bundle = 'export default "refetched";';
		const id = await publish(author, 'review.refetched', bundle);

		await ctx.storage.staging.delete((await findRow(id)).stagingKey);
		await review(moderator, id, { decision: 'approved' });

		expect(await ctx.storage.public.file('addons/review.refetched/1.0.0/index.js').text()).toBe(
			bundle,
		);
	});

	test('refuses a lost bundle whose pinned blob arrives altered, publishing nothing', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const id = await publish(author, 'review.refetch-tampered', 'export default 1;');

		await ctx.storage.staging.delete((await findRow(id)).stagingKey);
		github.tamper(true);

		try {
			expect(await failure(review(moderator, id, { decision: 'approved' }))).toEqual({
				status: 502,
				code: 'github_unavailable',
			});
		} finally {
			github.tamper(false);
		}

		expect((await findRow(id)).status).toBe('pending_review');
		expect(
			await ctx.storage.public.exists('addons/review.refetch-tampered/1.0.0/index.js'),
		).toBe(false);
	});

	test('grants developer on the first approved listing only', async () => {
		const { author, moderator } = await approvedAddon('review.first');

		expect(await getRole(author.userId)).toBe('developer');

		const update = await publish(author, 'review.first', 'export default 2;', '1.1.0');

		await review(moderator, update, { decision: 'approved' });

		expect(await getRole(author.userId)).toBe('developer');
	});

	test('does not demote a moderator whose listing is approved', async () => {
		const author = await signUp('moderator');
		const reviewer = await signUp('moderator');

		await review(reviewer, await publish(author, 'review.staff', 'staff'), {
			decision: 'approved',
		});

		expect(await getRole(author.userId)).toBe('moderator');
	});

	test('a delisted addon keeps its published files', async () => {
		const { moderator } = await approvedAddon('review.delisted');

		const { addon } = await moderator.client('POST /api/v1/addons/$id/delist', {
			params: { id: 'review.delisted' },
			response: addonResponseSchema,
		});

		expect(addon.delistedAt).not.toBeNull();
		expect(await ctx.storage.public.exists('addons/review.delisted/1.0.0/index.js')).toBe(true);
		expect(await ctx.storage.public.exists('addons/review.delisted/1.0.0/manifest.json')).toBe(
			true,
		);
	});
});

describe('who may review', () => {
	test('a plain user or developer cannot review at all', async () => {
		const author = await signUp();
		const id = await publish(author, 'review.unprivileged', 'bundle');

		for (const role of ['user', 'developer'] as const) {
			const reviewer = await signUp(role);

			expect(await failure(review(reviewer, id, { decision: 'approved' }))).toEqual({
				status: 403,
				code: 'forbidden',
			});
			expect(await failure(queue(reviewer))).toEqual({ status: 403, code: 'forbidden' });
		}
	});

	test('a moderator cannot review their own listing', async () => {
		const author = await signUp('moderator');
		const id = await publish(author, 'review.own-listing', 'bundle');

		expect(await failure(review(author, id, { decision: 'approved' }))).toEqual({
			status: 403,
			code: 'self_review',
		});
	});

	test('a maintainer with the moderator role cannot review an update to their addon', async () => {
		const { author } = await approvedAddon('review.own-update');
		const maintainer = await signUp('moderator');

		await ctx.db.insert(addonMaintainer).values({
			addonId: 'review.own-update',
			userId: maintainer.userId,
			role: 'maintainer',
		});

		const id = await publish(author, 'review.own-update', 'update', '1.1.0');

		expect(
			await failure(review(maintainer, id, { decision: 'rejected', note: 'No.' })),
		).toEqual({ status: 403, code: 'self_review' });
		expect((await findRow(id)).status).toBe('pending_review');
	});
});

describe('the queue', () => {
	test('lists pending submissions with their source, content, previous version and a download', async () => {
		const { author, moderator } = await approvedAddon('review.queued', 'version one');
		const bundle = 'version two';
		const id = await publish(author, 'review.queued', bundle, '2.0.0');

		const { submissions } = await queue(moderator, 'update');
		const item = submissions.find((entry) => entry.submission.id === id);

		expect(submissions.every((entry) => entry.submission.kind === 'update')).toBe(true);
		expect(item).toMatchObject({
			submission: { kind: 'update', status: 'pending_review' },
			source: {
				repository: REPOSITORY,
				path: 'plugins/review.queued',
				bundlePath: 'plugins/review.queued/dist/index.js',
			},
			manifest: { id: 'review.queued', version: '2.0.0' },
			changelog: { date: null, sections: [{ type: 'added', items: ['Hello.'] }] },
			addonMd: '# review.queued 2.0.0',
			previousAddonMd: '# review.queued 1.0.0',
			details: { htmlUrl: `https://github.com/${REPOSITORY}` },
			sha256: sha256(bundle),
			submitter: { id: author.userId, name: expect.any(String) },
			previousVersion: { version: '1.0.0' },
		});
		expect(await fetch(item?.artifact.url ?? '').then((response) => response.text())).toBe(
			bundle,
		);

		const listings = await queue(moderator, 'listing');

		expect(listings.submissions.some((entry) => entry.submission.id === id)).toBe(false);
	});
});

describe('rejection and requested changes', () => {
	test('rejecting deletes the staged bundle and frees the addon id', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const other = await signUp();
		const id = await publish(author, 'review.rejected', 'rejected');
		const { stagingKey } = await findRow(id);

		const { submission: reviewed } = await review(moderator, id, {
			decision: 'rejected',
			note: 'Malware.',
		});

		expect(reviewed).toMatchObject({
			status: 'rejected',
			review: { decision: 'rejected', note: 'Malware.' },
		});
		expect(await ctx.storage.staging.exists(stagingKey)).toBe(false);
		expect(await publish(other, 'review.rejected', 'mine now')).toBeString();
	});

	test('a rejection or change request needs a note', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const id = await publish(author, 'review.no-note', 'bundle');

		expect(
			await failure(review(moderator, id, { decision: 'changes_requested', note: ' ' })),
		).toEqual({ status: 400, code: 'invalid_request' });
	});

	test('requested changes return to the queue once the author republishes', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const first = await publish(author, 'review.changes', 'first try');

		await review(moderator, first, { decision: 'changes_requested', note: 'Add a README.' });

		const pending = await queue(moderator);

		expect(pending.submissions.some((entry) => entry.submission.id === first)).toBe(false);

		const second = await publish(author, 'review.changes', 'second try');
		const requeued = await queue(moderator, 'listing');

		expect(await findRow(first)).toMatchObject({
			status: 'superseded',
			reviewDecision: 'changes_requested',
		});
		expect(requeued.submissions.some((entry) => entry.submission.id === second)).toBe(true);
		expect(await failure(review(moderator, first, { decision: 'approved' }))).toEqual({
			status: 409,
			code: 'submission_not_pending',
		});
	});
});
