import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';

import { createSubmission, previewSubmission } from '~/lib/submissions';
import { listReviewQueue, reviewSubmission } from '~/lib/review';
import { addonMaintainer, submission, user } from '~/db/schema';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { serveMemoryS3 } from './helpers/memory-s3';
import { rejection } from './helpers/server';

const REPOSITORY = 'acme/team';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const { ctx, close } = await createTestContext({
	S3_ENDPOINT: s3.url.href,
	GITHUB_API_URL: github.url.href,
});

afterAll(async () => {
	await Promise.all([s3.stop(true), github.stop()]);
	await close();
});

let users = 0;

async function signUp(role: Role = 'user'): Promise<Caller> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Member ${users}`,
		email: `member-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));
	await linkGitHub(ctx, userId, 'owner');

	return load(userId);
}

async function load(userId: string): Promise<Caller> {
	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'session' };
}

function request(id: string, version: string, maintainers?: string[]): CreateSubmissionRequest {
	const { request: pinned } = commitPlugin(
		github.repository(REPOSITORY),
		REPOSITORY,
		id,
		version,
	);

	return maintainers ? { ...pinned, details: { maintainers } } : pinned;
}

async function submit(author: Caller, id: string, version: string, maintainers?: string[]) {
	const { submission: created } = await createSubmission(
		ctx,
		author,
		request(id, version, maintainers),
	);

	return created.id;
}

async function membersOf(addonId: string): Promise<Record<string, string>> {
	const rows = await ctx.db
		.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
		.from(addonMaintainer)
		.where(eq(addonMaintainer.addonId, addonId))
		.orderBy(asc(addonMaintainer.userId));

	return Object.fromEntries(rows.map((row) => [row.userId, row.role]));
}

// A live 1.0.0 owned by a fresh author, with `maintainers` besides them.
async function listed(id: string, maintainers?: string[]) {
	const author = await signUp();
	const moderator = await signUp('moderator');

	await reviewSubmission(ctx, moderator, await submit(author, id, '1.0.0', maintainers), {
		decision: 'approved',
	});

	// Approval made the author a developer, who may submit updates.
	return { author: await load(author.user.id), moderator };
}

describe('naming maintainers', () => {
	test('refuses unknown users, owners and the author of a new listing, storing nothing', async () => {
		const author = await signUp();
		const { author: owner } = await listed('team.owned');

		expect(
			await rejection(
				createSubmission(ctx, author, request('team.unknown', '1.0.0', ['nobody'])),
			),
		).toMatchObject({ code: 'not_found', message: 'User nobody does not exist.' });
		expect(
			await rejection(
				createSubmission(ctx, author, request('team.self', '1.0.0', [author.user.id])),
			),
		).toMatchObject({ code: 'invalid_request' });
		expect(
			await rejection(
				createSubmission(ctx, owner, request('team.owned', '1.1.0', [owner.user.id])),
			),
		).toMatchObject({ code: 'invalid_request' });

		const rows = await ctx.db.query.submission.findMany({
			where: { addonId: { in: ['team.unknown', 'team.self'] } },
		});
		const updates = await ctx.db.query.submission.findMany({
			where: { addonId: 'team.owned', version: '1.1.0' },
		});

		expect([...rows, ...updates]).toEqual([]);
	});

	test('only an owner may name the maintainers of an update', async () => {
		const helper = await signUp('developer');
		const { author } = await listed('team.helped', [helper.user.id]);

		expect(
			await rejection(
				createSubmission(ctx, helper, request('team.helped', '1.1.0', [author.user.id])),
			),
		).toMatchObject({ code: 'forbidden' });
		expect(
			await rejection(previewSubmission(ctx, helper, request('team.helped', '1.1.0', []))),
		).toMatchObject({ code: 'forbidden' });

		// Leaving maintainers out is fine.
		expect(await submit(helper, 'team.helped', '1.1.0')).toBeString();
	});

	test('stores the named maintainers, or null when the author named none', async () => {
		const author = await signUp();
		const helper = await signUp();
		const named = await submit(author, 'team.stored', '1.0.0', [helper.user.id]);
		const unnamed = await submit(author, 'team.unnamed', '1.0.0');
		const rows = await ctx.db
			.select({ id: submission.id, maintainers: submission.maintainers })
			.from(submission)
			.where(eq(submission.authorId, author.user.id));

		expect(Object.fromEntries(rows.map((row) => [row.id, row.maintainers]))).toEqual({
			[named]: [helper.user.id],
			[unnamed]: null,
		});
	});
});

describe('approval', () => {
	test('a new listing gets its named maintainers beside its owner', async () => {
		const helper = await signUp();
		const { author } = await listed('team.listing', [helper.user.id]);

		expect(await membersOf('team.listing')).toEqual({
			[author.user.id]: 'owner',
			[helper.user.id]: 'maintainer',
		});
	});

	test('an update with maintainers replaces the ones besides the owner', async () => {
		const kept = await signUp();
		const dropped = await signUp();
		const added = await signUp();
		const { author, moderator } = await listed('team.replaced', [
			kept.user.id,
			dropped.user.id,
		]);

		await reviewSubmission(
			ctx,
			moderator,
			await submit(author, 'team.replaced', '1.1.0', [kept.user.id, added.user.id]),
			{ decision: 'approved' },
		);

		expect(await membersOf('team.replaced')).toEqual({
			[author.user.id]: 'owner',
			[kept.user.id]: 'maintainer',
			[added.user.id]: 'maintainer',
		});
	});

	test('an update without maintainers keeps them, and an empty set removes them', async () => {
		const helper = await signUp();
		const { author, moderator } = await listed('team.kept', [helper.user.id]);

		await reviewSubmission(ctx, moderator, await submit(author, 'team.kept', '1.1.0'), {
			decision: 'approved',
		});

		expect(await membersOf('team.kept')).toEqual({
			[author.user.id]: 'owner',
			[helper.user.id]: 'maintainer',
		});

		await reviewSubmission(ctx, moderator, await submit(author, 'team.kept', '1.2.0', []), {
			decision: 'approved',
		});

		expect(await membersOf('team.kept')).toEqual({ [author.user.id]: 'owner' });
	});

	test('a rejected update leaves the maintainers alone', async () => {
		const helper = await signUp();
		const { author, moderator } = await listed('team.rejected');

		await reviewSubmission(
			ctx,
			moderator,
			await submit(author, 'team.rejected', '1.1.0', [helper.user.id]),
			{ decision: 'rejected', note: 'No.' },
		);

		expect(await membersOf('team.rejected')).toEqual({ [author.user.id]: 'owner' });
	});

	test('skips a named user deleted before approval', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const doomed = await signUp();
		const helper = await signUp();
		const id = await submit(author, 'team.deleted', '1.0.0', [doomed.user.id, helper.user.id]);

		await ctx.db.delete(user).where(eq(user.id, doomed.user.id));
		await reviewSubmission(ctx, moderator, id, { decision: 'approved' });

		expect(await membersOf('team.deleted')).toEqual({
			[author.user.id]: 'owner',
			[helper.user.id]: 'maintainer',
		});
	});
});

describe('preview and review', () => {
	test('a preview suggests the current maintainers and says who may change them', async () => {
		const helper = await signUp('developer');
		const author = await signUp();
		const { author: owner } = await listed('team.suggest', [helper.user.id]);
		const fresh = await previewSubmission(ctx, author, request('team.suggest-new', '1.0.0'));
		const update = await previewSubmission(ctx, owner, request('team.suggest', '1.1.0'));
		const helped = await previewSubmission(ctx, helper, request('team.suggest', '1.1.0'));

		expect(fresh.preview).toMatchObject({ suggestedMaintainers: [], canEditMaintainers: true });
		expect(update.preview).toMatchObject({
			suggestedMaintainers: [{ id: helper.user.id, name: helper.user.name, image: null }],
			canEditMaintainers: true,
		});
		expect(helped.preview.canEditMaintainers).toBe(false);
	});

	test('shows reviewers who approval adds and removes, or null for unchanged', async () => {
		const dropped = await signUp();
		const added = await signUp();
		const { author, moderator } = await listed('team.queued', [dropped.user.id]);
		const changed = await submit(author, 'team.queued', '1.1.0', [added.user.id]);
		const { submissions } = await listReviewQueue(ctx, moderator, 'update');
		const entry = submissions.find((item) => item.submission.id === changed);

		expect(entry?.maintainers).toEqual({
			added: [{ id: added.user.id, name: added.user.name, image: null }],
			removed: [{ id: dropped.user.id, name: dropped.user.name, image: null }],
		});

		await reviewSubmission(ctx, moderator, changed, { decision: 'rejected', note: 'No.' });

		const unchanged = await submit(author, 'team.queued', '1.2.0');
		const { submissions: next } = await listReviewQueue(ctx, moderator, 'update');

		expect(next.find((item) => item.submission.id === unchanged)?.maintainers).toBeNull();
	});
});
