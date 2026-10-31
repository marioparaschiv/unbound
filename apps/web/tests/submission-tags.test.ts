import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';

import { createSubmission, previewSubmission } from '~/lib/submissions';
import { listReviewQueue, reviewSubmission } from '~/lib/review';
import { addonTag, submission, tag, user } from '~/db/schema';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { serveMemoryS3 } from './helpers/memory-s3';
import { rejection } from './helpers/server';

const REPOSITORY = 'acme/addons';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: { topics: ['privacy', 'discord', 'utility'] } },
	tokens: { owner: { push: [REPOSITORY] } },
});

const { ctx, close } = await createTestContext({
	S3_ENDPOINT: s3.url.href,
	GITHUB_API_URL: github.url.href,
});

await ctx.db.insert(tag).values([
	{ id: 'privacy', label: 'Privacy', color: '#22c55e', position: 0 },
	{ id: 'utility', label: 'Utility', color: '#3b82f6', position: 1 },
	{ id: 'fun', label: 'Fun', color: '#f59e0b', position: 2 },
	{ id: 'doomed', label: 'Doomed', color: '#ef4444', position: 3 },
]);

afterAll(async () => {
	await Promise.all([s3.stop(true), github.stop()]);
	await close();
});

let users = 0;

async function signUp(role: Role = 'user'): Promise<Caller> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Tagger ${users}`,
		email: `tagger-${users}@example.com`,
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

function request(id: string, version: string, tags?: string[]): CreateSubmissionRequest {
	const { request: pinned } = commitPlugin(
		github.repository(REPOSITORY),
		REPOSITORY,
		id,
		version,
	);

	return tags ? { ...pinned, details: { tags } } : pinned;
}

async function submit(author: Caller, id: string, version: string, tags?: string[]) {
	const { submission: created } = await createSubmission(ctx, author, request(id, version, tags));

	return created.id;
}

async function tagsOf(addonId: string): Promise<string[]> {
	const rows = await ctx.db
		.select({ id: addonTag.tagId })
		.from(addonTag)
		.where(eq(addonTag.addonId, addonId))
		.orderBy(asc(addonTag.tagId));

	return rows.map((row) => row.id);
}

// A live 1.0.0 owned by a fresh author, filed under `tags`.
async function listed(id: string, tags: string[]) {
	const author = await signUp();
	const moderator = await signUp('moderator');

	await reviewSubmission(ctx, moderator, await submit(author, id, '1.0.0', tags), {
		decision: 'approved',
	});

	// Approval made the author a developer, who may submit updates.
	return { author: await load(author.user.id), moderator };
}

describe('choosing tags', () => {
	test('refuses tag ids that name no tag, storing nothing', async () => {
		const author = await signUp();
		const attempt = createSubmission(
			ctx,
			author,
			request('tags.unknown', '1.0.0', ['privacy', 'nope']),
		);

		expect(await rejection(attempt)).toMatchObject({
			code: 'invalid_request',
			message: 'Unknown tags: nope.',
		});

		const rows = await ctx.db
			.select()
			.from(submission)
			.where(eq(submission.addonId, 'tags.unknown'));

		expect(rows).toEqual([]);
	});

	test('stores the chosen tags, or null when the author chose none', async () => {
		const author = await signUp();
		const chosen = await submit(author, 'tags.stored', '1.0.0', ['utility', 'privacy']);
		const unchosen = await submit(author, 'tags.unchosen', '1.0.0');
		const rows = await ctx.db.query.submission.findMany({
			where: { id: { in: [chosen, unchosen] } },
			columns: { id: true, tags: true },
		});

		expect(Object.fromEntries(rows.map((row) => [row.id, row.tags]))).toEqual({
			[chosen]: ['utility', 'privacy'],
			[unchosen]: null,
		});
	});

	test('shows reviewers the chosen tags in menu order, or null for unchanged', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const chosen = await submit(author, 'tags.queued', '1.0.0', ['fun', 'privacy']);
		const unchosen = await submit(author, 'tags.queued-none', '1.0.0');
		const { submissions } = await listReviewQueue(ctx, moderator, 'listing');
		const tagsById = new Map(submissions.map((entry) => [entry.submission.id, entry.tags]));

		expect(tagsById.get(chosen)?.map((entry) => entry.id)).toEqual(['privacy', 'fun']);
		expect(tagsById.get(unchosen)).toBeNull();
	});
});

describe('approval', () => {
	test('files a new listing under its chosen tags', async () => {
		await listed('tags.listing', ['privacy', 'fun']);

		expect(await tagsOf('tags.listing')).toEqual(['fun', 'privacy']);
	});

	test('an update with tags replaces the addon’s tags', async () => {
		const { author, moderator } = await listed('tags.replaced', ['privacy', 'fun']);

		await reviewSubmission(
			ctx,
			moderator,
			await submit(author, 'tags.replaced', '1.1.0', ['utility']),
			{
				decision: 'approved',
			},
		);

		expect(await tagsOf('tags.replaced')).toEqual(['utility']);
	});

	test('an update with no tags chosen keeps the addon’s tags, and an empty choice clears them', async () => {
		const { author, moderator } = await listed('tags.kept', ['privacy']);

		await reviewSubmission(ctx, moderator, await submit(author, 'tags.kept', '1.1.0'), {
			decision: 'approved',
		});

		expect(await tagsOf('tags.kept')).toEqual(['privacy']);

		await reviewSubmission(ctx, moderator, await submit(author, 'tags.kept', '1.2.0', []), {
			decision: 'approved',
		});

		expect(await tagsOf('tags.kept')).toEqual([]);
	});

	test('a rejected update leaves the addon’s tags alone', async () => {
		const { author, moderator } = await listed('tags.rejected', ['privacy']);

		await reviewSubmission(
			ctx,
			moderator,
			await submit(author, 'tags.rejected', '1.1.0', ['fun']),
			{
				decision: 'rejected',
				note: 'No.',
			},
		);

		expect(await tagsOf('tags.rejected')).toEqual(['privacy']);
	});

	test('skips a chosen tag deleted before approval', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const id = await submit(author, 'tags.deleted', '1.0.0', ['doomed', 'utility']);

		await ctx.db.delete(tag).where(eq(tag.id, 'doomed'));
		await reviewSubmission(ctx, moderator, id, { decision: 'approved' });

		expect(await tagsOf('tags.deleted')).toEqual(['utility']);
	});
});

describe('suggested tags', () => {
	test('a new listing suggests the repository topics that are tags', async () => {
		const author = await signUp();
		const { preview } = await previewSubmission(
			ctx,
			author,
			request('tags.suggest-new', '1.0.0'),
		);

		expect(preview.suggestedTags).toEqual(['privacy', 'utility']);
	});

	test('an update suggests the addon’s current tags', async () => {
		const { author } = await listed('tags.suggest-update', ['fun']);
		const { preview } = await previewSubmission(
			ctx,
			author,
			request('tags.suggest-update', '1.1.0'),
		);

		expect(preview.suggestedTags).toEqual(['fun']);
	});

	test('a preview refuses unknown tag ids too', async () => {
		const author = await signUp();

		expect(
			await rejection(
				previewSubmission(ctx, author, request('tags.suggest-bad', '1.0.0', ['nope'])),
			),
		).toMatchObject({ code: 'invalid_request' });
	});
});
