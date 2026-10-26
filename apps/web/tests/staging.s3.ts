import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import type { AppContext } from '~/lib/context';
import { submission, user } from '~/db/schema';
import { sweepStaging } from '~/lib/staging';

import {
	S3_TEST_ENV,
	authRequest,
	createTestContext,
	linkGitHub,
	signInWithDiscord,
} from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';
import { commitPlugin, serveGitHub } from './helpers/github';

const MINUTE_MS = 60_000;
const REPOSITORY = 'acme/addons';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const base = await createTestContext({ ...S3_TEST_ENV, GITHUB_API_URL: github.url.href });
const grace = base.ctx.env.STAGING_ORPHAN_GRACE_SECONDS * 1000;

// Objects are stamped by MinIO's clock, so the sweep runs on the real clock shifted by `ahead`.
let ahead = 0;
const ctx: AppContext = { ...base.ctx, now: () => new Date(Date.now() + ahead) };

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await github.stop();
	await base.close();
});

function sweepAfter(ms: number) {
	ahead = ms;

	return sweepStaging(ctx).finally(() => {
		ahead = 0;
	});
}

let users = 0;

async function signUp() {
	users += 1;

	return signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Author ${users}`,
		email: `author-${users}@example.com`,
	});
}

function staged(key: string) {
	return ctx.storage.staging.exists(key);
}

async function statusOf(id: string) {
	const [row] = await ctx.db.select().from(submission).where(eq(submission.id, id));

	return row?.status;
}

describe('sweepStaging', () => {
	test('deletes staged objects no open submission owns and keeps the rest', async () => {
		const { userId } = await signUp();
		const pending = await seedSubmission(ctx, userId, manifest('sweep.pending'));
		const approved = await seedSubmission(ctx, userId, manifest('sweep.approved'), {
			status: 'approved',
		});
		const orphan = `submissions/${Bun.randomUUIDv7()}/bundle`;

		await Promise.all(
			[pending.stagingKey, approved.stagingKey, orphan].map((key) =>
				ctx.storage.staging.write(key, 'bundle'),
			),
		);

		await sweepAfter(grace + MINUTE_MS);

		expect(await staged(pending.stagingKey)).toBe(true);
		expect(await staged(approved.stagingKey)).toBe(false);
		expect(await staged(orphan)).toBe(false);
	});

	test('keeps an orphan younger than STAGING_ORPHAN_GRACE_SECONDS, as create stages before inserting', async () => {
		const orphan = `submissions/${Bun.randomUUIDv7()}/bundle`;

		await ctx.storage.staging.write(orphan, 'bundle');

		expect(await sweepAfter(0)).toEqual({ orphans: 0 });
		expect(await staged(orphan)).toBe(true);

		await sweepAfter(grace + MINUTE_MS);

		expect(await staged(orphan)).toBe(false);
	});
});

describe('banning a user', () => {
	test('cancels their open submissions, deletes their staged files and frees their ids', async () => {
		const banned = await signUp();
		const admin = await signUp();
		const other = await signUp();

		await ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, admin.userId));
		await seedApprovedAddon(ctx, banned.userId, manifest('ban.approved'));

		const listing = await seedSubmission(ctx, banned.userId, manifest('ban.listing'));
		const update = await seedSubmission(ctx, banned.userId, manifest('ban.approved', '1.1.0'), {
			kind: 'update',
			status: 'changes_requested',
		});

		await ctx.storage.staging.write(listing.stagingKey, 'listing');
		await ctx.storage.staging.write(update.stagingKey, 'update');

		const response = await authRequest(ctx, '/admin/ban-user', {
			method: 'POST',
			headers: admin.headers,
			body: JSON.stringify({ userId: banned.userId, banReason: 'Spam' }),
		});

		expect(response.status).toBe(200);
		expect([await statusOf(listing.id), await statusOf(update.id)]).toEqual([
			'cancelled',
			'cancelled',
		]);
		expect(await staged(listing.stagingKey)).toBe(false);
		expect(await staged(update.stagingKey)).toBe(false);

		await linkGitHub(ctx, other.userId, 'owner');

		const claimed = await createSubmissionEndpoint.handle(
			ctx,
			new Request(new URL('/api/v1/submissions', ctx.env.PUBLIC_URL), {
				method: 'POST',
				headers: other.headers,
				body: JSON.stringify(
					commitPlugin(github.repository(REPOSITORY), REPOSITORY, 'ban.listing').request,
				),
			}),
		);

		expect(createSubmissionResponseSchema.parse(await claimed.json()).submission.kind).toBe(
			'listing',
		);
		expect(
			await ctx.db.query.addonVersion.findFirst({ where: { addonId: 'ban.approved' } }),
		).toBeDefined();
	});
});
