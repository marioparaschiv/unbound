import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { listReviewQueue, reviewSubmission } from '~/lib/review';
import { createSubmission } from '~/lib/submissions';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from '../helpers/context';
import { commitPlugin, serveGitHub } from '../helpers/github';
import { serveMemoryS3 } from '../helpers/memory-s3';
import { rejection } from '../helpers/server';

const REPOSITORY = 'acme/addons';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

// Refuses every write while `failing`, as a storage outage after the approval committed would.
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
});

afterAll(async () => {
	await Promise.all([flaky.stop(true), s3.stop(true), github.stop()]);
	await close();
});

let users = 0;

async function signUp(role: Role = 'user'): Promise<Caller> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Recoverer ${users}`,
		email: `recoverer-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));
	await linkGitHub(ctx, userId, 'owner');

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'session' };
}

async function submit(author: Caller, id: string) {
	const { request } = commitPlugin(github.repository(REPOSITORY), REPOSITORY, id, '1.0.0');
	const { submission } = await createSubmission(ctx, author, request);

	return submission.id;
}

function versionOf(addonId: string) {
	return ctx.db.query.addonVersion.findFirst({ where: { addonId, version: '1.0.0' } });
}

async function approveWithFailingWrite(id: string, reviewer: Caller, addonId: string) {
	failing = true;

	try {
		expect(
			await rejection(reviewSubmission(ctx, reviewer, id, { decision: 'approved' })),
		).toBeInstanceOf(Error);
	} finally {
		failing = false;
	}

	expect((await versionOf(addonId))?.filesPendingSince).toBeInstanceOf(Date);
}

describe('publish recovery through the queue', () => {
	test('an approved version with unwritten files stays queued until any reviewer retries it', async () => {
		const author = await signUp();
		const first = await signUp('moderator');
		const second = await signUp('moderator');
		const id = await submit(author, 'recover.queue');

		await approveWithFailingWrite(id, first, 'recover.queue');

		// A reload reads the queue afresh: no dialog state survives.
		const { submissions } = await listReviewQueue(ctx, second);
		const queued = submissions.find((entry) => entry.submission.id === id);

		expect(queued?.submission.status).toBe('approved');

		await reviewSubmission(ctx, second, id, { decision: 'approved' });

		expect((await versionOf('recover.queue'))?.filesPendingSince).toBeNull();
		expect(
			(await listReviewQueue(ctx, second)).submissions.some(
				(entry) => entry.submission.id === id,
			),
		).toBe(false);
	});

	test('a published version refuses a repeated approval', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const id = await submit(author, 'recover.done');

		await reviewSubmission(ctx, reviewer, id, { decision: 'approved' });

		expect(
			await rejection(reviewSubmission(ctx, reviewer, id, { decision: 'approved' })),
		).toMatchObject({ code: 'submission_not_pending' });
	});

	test('a pending submission is queued without being flagged', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const id = await submit(author, 'recover.pending');
		const { submissions } = await listReviewQueue(ctx, reviewer);

		expect(submissions.find((entry) => entry.submission.id === id)?.submission.status).toBe(
			'pending_review',
		);
	});
});
