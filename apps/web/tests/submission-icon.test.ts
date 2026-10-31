import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { createSubmission, previewSubmission } from '~/lib/submissions';
import { addon, submission, user } from '~/db/schema';
import { reviewSubmission } from '~/lib/review';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { serveMemoryS3 } from './helpers/memory-s3';
import { rejection } from './helpers/server';

const REPOSITORY = 'acme/addons';

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
		name: `Iconer ${users}`,
		email: `iconer-${users}@example.com`,
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

function request(id: string, version: string, icon?: string): CreateSubmissionRequest {
	const { request: pinned } = commitPlugin(
		github.repository(REPOSITORY),
		REPOSITORY,
		id,
		version,
	);

	return icon ? { ...pinned, details: { icon } } : pinned;
}

async function iconOf(addonId: string): Promise<string | null | undefined> {
	const row = await ctx.db.query.addon.findFirst({
		where: { id: addonId },
		columns: { icon: true },
	});

	return row?.icon;
}

describe('a new listing picking its icon', () => {
	test('refuses a name that is not a pickable icon, in preview and on submit', async () => {
		const author = await signUp();
		const bad = request('icon.bad', '1.0.0', 'IconNotARealIcon');

		expect(await rejection(previewSubmission(ctx, author, bad))).toMatchObject({
			code: 'invalid_request',
		});
		expect(await rejection(createSubmission(ctx, author, bad))).toMatchObject({
			code: 'invalid_request',
		});
		expect(
			await ctx.db.select().from(submission).where(eq(submission.addonId, 'icon.bad')),
		).toEqual([]);
	});

	test('sets the addon icon on approval, and leaves the default when none was picked', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const picked = await createSubmission(
			ctx,
			author,
			request('icon.picked', '1.0.0', 'IconApple'),
		);
		const plain = await createSubmission(ctx, author, request('icon.plain', '1.0.0'));

		await reviewSubmission(ctx, moderator, picked.submission.id, { decision: 'approved' });
		await reviewSubmission(ctx, moderator, plain.submission.id, { decision: 'approved' });

		expect(await iconOf('icon.picked')).toBe('IconApple');
		expect(await iconOf('icon.plain')).toBeNull();
	});

	test('refuses an icon on an update, which changes icons from the dashboard', async () => {
		const author = await signUp();
		const moderator = await signUp('moderator');
		const first = await createSubmission(ctx, author, request('icon.update', '1.0.0'));

		await reviewSubmission(ctx, moderator, first.submission.id, { decision: 'approved' });

		const update = createSubmission(
			ctx,
			await load(author.user.id),
			request('icon.update', '1.1.0', 'IconApple'),
		);

		expect(await rejection(update)).toMatchObject({ code: 'invalid_request' });
		expect(await iconOf('icon.update')).toBeNull();
		expect(
			await ctx.db.select({ id: addon.id }).from(addon).where(eq(addon.id, 'icon.update')),
		).toHaveLength(1);
	});
});
