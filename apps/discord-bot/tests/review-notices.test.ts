import { manifest, recordReviewDecision, schema, seedSubmission } from '@unbound-app/web/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { ReviewDecision, SubmissionKind } from '@unbound-app/contracts/publish';
import { and, asc, eq } from 'drizzle-orm';
import type { Client } from 'discord.js';

import { reviewNoticesDispatcher } from '~/dispatchers/review-notices';
import type { DispatcherContext } from '~/dispatchers/types';
import { reviewNotice } from '~/db/schema';

import { createBotTestDatabase, DATABASE_URL, type BotTestDatabase } from './helpers/database';
import { createFakeClient, createFakeDiscord, type FakeDiscord } from './helpers/fake-discord';
import { signUp, type WebUser } from './helpers/web';

type Decision = {
	decision: ReviewDecision;
	version?: string;
	kind?: SubmissionKind;
	note?: string;
	build?: { repository: string; commitSha: string; ref: string };
};

let addons = 0;

describe.skipIf(!DATABASE_URL)('review notices dispatcher', () => {
	let database: BotTestDatabase;
	let fake: FakeDiscord;
	let clients: Client<true>[];

	beforeAll(async () => {
		database = await createBotTestDatabase();
	});

	afterAll(async () => {
		await database.drop();
	});

	beforeEach(async () => {
		await database.db.delete(reviewNotice);
		fake = createFakeDiscord();
		clients = [];
	});

	afterEach(async () => {
		await Promise.all(clients.map((client) => client.destroy()));
		fake.stop();
	});

	// A fresh client per call stands in for a restarted bot process.
	function context(): DispatcherContext {
		const client = createFakeClient(fake);

		clients.push(client);

		return { db: database.db, web: database.reads, client };
	}

	// Each decision is on its own addon, named after its version so titles tell them apart.
	async function decide(author: WebUser, { decision, version = '1.0.0', ...rest }: Decision) {
		addons += 1;

		const row = await seedSubmission(
			database.web,
			author.userId,
			manifest(`notices.addon-${addons}`, version, { name: `Addon ${addons}` }),
			{
				kind: rest.kind ?? 'update',
				status: decision,
				reviewDecision: decision,
				reviewedAt: database.web.now(),
				reviewNote: rest.note ?? null,
			},
			null,
		);

		await database.web.db.transaction((tx) => recordReviewDecision(tx, row, rest.build));

		return `Addon ${addons}`;
	}

	async function enabled() {
		await reviewNoticesDispatcher.reconcile(context());
	}

	function titles(userId: string) {
		return fake.dms(userId).map((message) => message.embeds[0]?.title);
	}

	async function outcomes() {
		const rows = await database.db
			.select({ outcome: reviewNotice.outcome })
			.from(reviewNotice)
			.orderBy(asc(reviewNotice.eventId));

		return rows.map((row) => row.outcome);
	}

	test('the first run DMs nobody about decisions made before notices were enabled', async () => {
		const author = await signUp(database.web);

		await decide(author, { decision: 'approved' });
		await reviewNoticesDispatcher.reconcile(context());

		expect(fake.requests).toEqual([]);
		expect(await outcomes()).toEqual(['floor']);

		const name = await decide(author, { decision: 'rejected', version: '2.0.0' });

		await reviewNoticesDispatcher.handle('', context());

		expect(titles(author.discordId)).toEqual([`Your update to ${name} 2.0.0 was rejected`]);
	});

	test('each decision DMs its author once, in event order, across repeated runs', async () => {
		const author = await signUp(database.web);

		await enabled();

		const approved = await decide(author, { decision: 'approved', note: 'Lovely.' });
		const rejected = await decide(author, { decision: 'rejected', kind: 'listing' });
		const changes = await decide(author, { decision: 'changes_requested' });

		await reviewNoticesDispatcher.handle('', context());
		await reviewNoticesDispatcher.reconcile(context());
		await reviewNoticesDispatcher.handle('', context());

		expect(titles(author.discordId)).toEqual([
			`Your update to ${approved} 1.0.0 was approved`,
			`Your new addon ${rejected} 1.0.0 was rejected`,
			`Your update to ${changes} 1.0.0 needs changes`,
		]);
		expect(fake.dms(author.discordId)[0]?.embeds[0]?.description).toStartWith('> Lovely.');
		expect(fake.requests.map((request) => request.allowed_mentions)).toEqual(
			Array.from({ length: 3 }, () => ({ parse: [] })),
		);

		const sent = await database.db
			.select({ messageId: reviewNotice.messageId })
			.from(reviewNotice)
			.where(eq(reviewNotice.outcome, 'sent'))
			.orderBy(asc(reviewNotice.eventId));

		expect(sent.map((row) => row.messageId)).toEqual(
			fake.dms(author.discordId).map((message) => message.id),
		);
	});

	test('a CI deploy and other moderation events DM nobody', async () => {
		const author = await signUp(database.web);

		await enabled();
		await decide(author, {
			decision: 'approved',
			build: { repository: 'owner/repo', commitSha: 'abc', ref: 'plugin-builds/abc' },
		});
		await database.web.db.insert(schema.moderationEvent).values({
			subjectType: 'user',
			subjectId: author.userId,
			kind: 'user.unbanned',
			data: {},
			createdAt: new Date(),
		});
		await reviewNoticesDispatcher.handle('', context());

		expect(fake.requests).toEqual([]);

		const name = await decide(author, { decision: 'approved' });

		await reviewNoticesDispatcher.handle('', context());

		expect(titles(author.discordId)).toEqual([`Your update to ${name} 1.0.0 was approved`]);
	});

	test('an author without a linked Discord account is recorded without a send', async () => {
		const author = await signUp(database.web);

		await enabled();
		await database.web.db
			.delete(schema.account)
			.where(
				and(
					eq(schema.account.userId, author.userId),
					eq(schema.account.providerId, 'discord'),
				),
			);
		await decide(author, { decision: 'rejected' });
		await reviewNoticesDispatcher.handle('', context());

		expect(fake.requests).toEqual([]);
		expect(await outcomes()).toEqual(['floor', 'unlinked']);
	});

	test('an author with closed DMs is recorded as undeliverable and later notices still go out', async () => {
		const closed = await signUp(database.web);
		const open = await signUp(database.web);

		await enabled();
		fake.closedDms.add(closed.discordId);
		await decide(closed, { decision: 'approved' });

		const name = await decide(open, { decision: 'approved' });

		await reviewNoticesDispatcher.handle('', context());

		expect(fake.dms(closed.discordId)).toEqual([]);
		expect(titles(open.discordId)).toEqual([`Your update to ${name} 1.0.0 was approved`]);
		expect(await outcomes()).toEqual(['floor', 'undeliverable', 'sent']);
	});

	test('a Discord outage stops the run, and the next run resumes in order', async () => {
		const author = await signUp(database.web);

		await enabled();

		const first = await decide(author, { decision: 'approved' });
		const second = await decide(author, { decision: 'rejected' });

		fake.outage = true;

		const [run] = await Promise.allSettled([reviewNoticesDispatcher.handle('', context())]);

		expect(run?.status).toBe('rejected');
		expect(await outcomes()).toEqual(['floor']);

		fake.outage = false;
		await reviewNoticesDispatcher.reconcile(context());

		expect(titles(author.discordId)).toEqual([
			`Your update to ${first} 1.0.0 was approved`,
			`Your update to ${second} 1.0.0 was rejected`,
		]);
		expect(await outcomes()).toEqual(['floor', 'sent', 'sent']);
	});
});
