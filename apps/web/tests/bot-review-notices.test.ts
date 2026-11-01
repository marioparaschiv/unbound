import type { ReviewDecision, SubmissionKind } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { recordReviewDecision, type FirstPartyBuild } from '~/lib/moderation-events';
import { account, moderationEvent } from '~/db/schema';
import { createBotReads } from '~/lib/bot';

import { createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';

const BUILD: FirstPartyBuild = { repository: 'owner/repo', commitSha: 'abc', ref: 'builds/abc' };

const { ctx, close } = await createTestContext();
const reads = createBotReads(ctx.db.$client, { siteUrl: 'https://unbound.rip' });

afterAll(close);

let users = 0;

async function signUp() {
	users += 1;

	const discordId = snowflakeAt(new Date(Date.UTC(2021, 0, users)));
	const { userId } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Author ${users}`,
		email: `review-notices-${users}@example.com`,
	});

	return { userId, discordId };
}

type Decided = {
	authorId: string;
	addonId: string;
	version: string;
	decision: ReviewDecision;
	kind?: SubmissionKind;
	note?: string | null;
	name?: string;
	build?: FirstPartyBuild;
};

async function decide({ authorId, addonId, version, decision, kind = 'update', ...rest }: Decided) {
	const row = await seedSubmission(
		ctx,
		authorId,
		manifest(addonId, version, rest.name ? { name: rest.name } : {}),
		{
			kind,
			status: decision,
			reviewDecision: decision,
			reviewedAt: ctx.now(),
			reviewNote: rest.note ?? null,
		},
		null,
	);

	await ctx.db.transaction((tx) => recordReviewDecision(tx, row, rest.build));
}

describe('review notices', () => {
	test('reads each human decision after an id, oldest first, with the author and the note', async () => {
		const author = await signUp();

		await seedApprovedAddon(ctx, author.userId, manifest('notices.listed', '1.0.0'));

		const after = await reads.newestEventId();

		await decide({
			authorId: author.userId,
			addonId: 'notices.listed',
			version: '1.1.0',
			decision: 'approved',
			note: 'Nice work.',
		});
		await ctx.db.insert(moderationEvent).values({
			subjectType: 'addon',
			subjectId: 'notices.listed',
			kind: 'addon.delisted',
			data: {},
			createdAt: new Date(),
		});
		await decide({
			authorId: author.userId,
			addonId: 'notices.new',
			version: '0.1.0',
			decision: 'changes_requested',
			kind: 'listing',
			name: 'Fresh Idea',
			note: 'Add a README.',
		});

		const notices = await reads.reviewNoticesAfter(after, 10);

		expect(notices).toEqual([
			{
				eventId: expect.any(Number),
				addonId: 'notices.listed',
				addonName: 'Hello',
				version: '1.1.0',
				submissionKind: 'update',
				decision: 'approved',
				note: 'Nice work.',
				createdAt: expect.any(Date),
				discordId: author.discordId,
			},
			{
				eventId: expect.any(Number),
				addonId: 'notices.new',
				addonName: 'Fresh Idea',
				version: '0.1.0',
				submissionKind: 'listing',
				decision: 'changes_requested',
				note: 'Add a README.',
				createdAt: expect.any(Date),
				discordId: author.discordId,
			},
		]);
		const [first, second] = notices;

		expect(await reads.reviewNoticesAfter(first?.eventId ?? 0, 10)).toEqual(
			second ? [second] : [],
		);
	});

	test('a CI deploy is never a notice and never fills a page ahead of a human decision', async () => {
		const author = await signUp();
		const after = await reads.newestEventId();

		for (const version of ['1.0.0', '1.0.1']) {
			await decide({
				authorId: author.userId,
				addonId: 'notices.first-party',
				version,
				decision: 'approved',
				build: BUILD,
			});
		}

		await decide({
			authorId: author.userId,
			addonId: 'notices.reviewed',
			version: '2.0.0',
			decision: 'rejected',
		});

		expect(await reads.reviewNoticesAfter(after, 1)).toMatchObject([
			{ addonId: 'notices.reviewed', decision: 'rejected', note: null },
		]);
	});

	test('an author without a Discord link has no Discord id', async () => {
		const author = await signUp();
		const after = await reads.newestEventId();

		await ctx.db
			.delete(account)
			.where(and(eq(account.userId, author.userId), eq(account.providerId, 'discord')));
		await decide({
			authorId: author.userId,
			addonId: 'notices.unlinked',
			version: '1.0.0',
			decision: 'rejected',
		});

		expect(await reads.reviewNoticesAfter(after, 10)).toMatchObject([
			{ addonId: 'notices.unlinked', discordId: null },
		]);
	});
});
