import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq, max } from 'drizzle-orm';

import type { Database, Transaction, TransactionBody } from '~/db/database';
import { upsertSponsorship } from '~/lib/sponsors/sponsorships';
import { deleteUserWithRecord } from '~/lib/moderation-events';
import type { Sponsorship } from '~/lib/sponsors/standing';
import { account, botFeedChange } from '~/db/schema';

import {
	SPONSORED_LOGIN,
	WEBHOOK_SECRET,
	deliver,
	sign,
	sponsorshipPayload,
	storedSponsorship,
} from './helpers/sponsors';
import { createTestContext, signInWithDiscord, snowflakeAt } from './helpers/context';

const NOW = new Date('2026-03-01T00:00:00Z');

const base = await createTestContext({
	GITHUB_SPONSORS_LOGIN: SPONSORED_LOGIN.toUpperCase(),
	GITHUB_SPONSORS_WEBHOOK_SECRET: WEBHOOK_SECRET,
});
const ctx = { ...base.ctx, now: () => NOW };
const unconfigured = await createTestContext();
const withoutLogin = await createTestContext({ GITHUB_SPONSORS_WEBHOOK_SECRET: WEBHOOK_SECRET });

afterAll(async () => {
	await Promise.all([base.close(), unconfigured.close(), withoutLogin.close()]);
});

async function statusOf(response: Response) {
	return { code: response.status, body: await response.json() };
}

async function hasLockWaiter(table: string): Promise<boolean> {
	const [row] = await ctx.db.$client<{ waiting: number }[]>`
		select count(*)::int as waiting from pg_locks
		where locktype = 'relation' and not granted
			and database = (select oid from pg_database where datname = current_database())
			and relation = ${table}::regclass`;

	return Boolean(row?.waiting);
}

async function waitUntil(check: () => Promise<boolean>, what: string) {
	for (let i = 0; i < 250; i++) {
		if (await check()) return;

		await Bun.sleep(20);
	}

	throw new Error(`Timed out waiting for ${what}.`);
}

async function memberSeq(userId: string, db: Pick<Transaction, 'select'> = ctx.db) {
	const [row] = await db
		.select({ seq: botFeedChange.seq })
		.from(botFeedChange)
		.where(and(eq(botFeedChange.feed, 'members'), eq(botFeedChange.key, userId)));

	return row?.seq ?? 0;
}

async function latestMemberSeq(): Promise<number> {
	const [row] = await ctx.db
		.select({ seq: max(botFeedChange.seq) })
		.from(botFeedChange)
		.where(eq(botFeedChange.feed, 'members'));

	return row?.seq ?? 0;
}

describe('webhook authentication', () => {
	const payload = sponsorshipPayload({ action: 'created', sponsorId: '100' });

	test('a correctly signed delivery is applied', async () => {
		const response = await deliver(ctx, payload, { id: 'auth-ok' });

		expect(await statusOf(response)).toEqual({ code: 200, body: { status: 'applied' } });
		expect(await storedSponsorship(ctx, '100')).toMatchObject({
			state: 'active',
			tierName: '$5 a month',
		});
	});

	test('a wrong secret, a tampered body and a missing signature are refused', async () => {
		const body = JSON.stringify(sponsorshipPayload({ action: 'created', sponsorId: '101' }));
		const tampered = body.replace('500', '50000');

		const responses = await Promise.all([
			deliver(ctx, body, { id: 'auth-secret', secret: 'not-the-secret' }),
			deliver(ctx, tampered, { id: 'auth-tamper', signature: sign(WEBHOOK_SECRET, body) }),
			deliver(ctx, body, { id: 'auth-missing', signature: null }),
			deliver(ctx, body, { id: 'auth-short', signature: 'sha256=abc' }),
		]);

		expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
		expect(await storedSponsorship(ctx, '101')).toBeUndefined();
	});

	test('the endpoint does not exist without a webhook secret and a sponsored login', async () => {
		const unset = await deliver(unconfigured.ctx, payload, { id: 'auth-unset' });
		const noLogin = await deliver(withoutLogin.ctx, payload, { id: 'auth-no-login' });

		expect([unset.status, noLogin.status]).toEqual([404, 404]);
	});

	test('oversized and non-JSON bodies are refused', async () => {
		const huge = await deliver(ctx, 'x'.repeat(1024 * 1024 + 1), { id: 'auth-huge' });
		const form = await deliver(ctx, payload, { id: 'auth-form', contentType: 'text/plain' });

		expect([huge.status, form.status]).toEqual([413, 415]);
	});
});

describe('webhook events', () => {
	test('ping, other events and other sponsored accounts are acknowledged without changes', async () => {
		const other = sponsorshipPayload({
			action: 'created',
			sponsorId: '200',
			sponsorable: 'someone-else',
		});

		const responses = await Promise.all([
			deliver(ctx, { zen: 'Keep it logically awesome.' }, { id: 'evt-ping', event: 'ping' }),
			deliver(ctx, other, { id: 'evt-other' }),
		]);

		expect(responses.map((response) => response.status)).toEqual([202, 202]);
		expect(await storedSponsorship(ctx, '200')).toBeUndefined();
	});

	test('created, pending cancellation then cancelled moves through each state', async () => {
		const id = '300';

		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'seq-1',
		});
		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'active', endsAt: null });

		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'pending_cancellation',
				sponsorId: id,
				effectiveDate: '2026-04-01T00:00:00+00:00',
			}),
			{ id: 'seq-2' },
		);
		expect(await storedSponsorship(ctx, id)).toMatchObject({
			state: 'pending_cancellation',
			endsAt: new Date('2026-04-01T00:00:00Z'),
		});

		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'seq-3',
		});
		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'cancelled', endsAt: NOW });
	});

	test('a tier change updates the tier and keeps the state', async () => {
		const id = '350';

		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'tier-1',
		});
		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'tier_changed',
				sponsorId: id,
				tierName: '$1 a month',
				cents: 100,
			}),
			{ id: 'tier-2' },
		);

		expect(await storedSponsorship(ctx, id)).toMatchObject({
			state: 'active',
			tierName: '$1 a month',
			monthlyPriceCents: 100,
		});
	});

	test('replaying a delivery id changes nothing, even after a later event', async () => {
		const id = '400';
		const created = sponsorshipPayload({ action: 'created', sponsorId: id });

		await deliver(ctx, created, { id: 'replay-1' });
		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'replay-2',
		});

		const before = await storedSponsorship(ctx, id);
		const response = await deliver(ctx, created, { id: 'replay-1' });

		expect(await statusOf(response)).toEqual({ code: 200, body: { status: 'duplicate' } });
		expect(await storedSponsorship(ctx, id)).toEqual(before);
		expect(before?.state).toBe('cancelled');
	});

	test('a cancellation delivered before its creation stays cancelled', async () => {
		const id = '500';

		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'order-1',
		});
		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'order-2',
		});

		expect((await storedSponsorship(ctx, id))?.state).toBe('cancelled');

		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'created',
				sponsorId: id,
				createdAt: '2026-02-15T00:00:00+00:00',
			}),
			{ id: 'order-3' },
		);

		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'active', endsAt: null });
	});
});

describe('webhook racing a GitHub link', () => {
	test('a link committing while a delivery is applied still moves the member after it', async () => {
		const githubId = '7700';
		const { userId } = await signInWithDiscord(ctx, {
			id: snowflakeAt(new Date('2021-01-01T00:00:00Z')),
			name: 'Racing sponsor',
			email: 'racing-sponsor@example.com',
		});
		const { internalAdapter } = await ctx.auth.$context;
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();

		// Holding sponsorship parks the delivery's upsert after its snapshot is taken.
		const blocker = ctx.db.$client.begin(async (sql) => {
			await sql`lock table sponsorship in exclusive mode`;
			locked.resolve();
			await release.promise;
		});

		await locked.promise;

		const delivery = deliver(
			ctx,
			sponsorshipPayload({ action: 'created', sponsorId: githubId }),
			{
				id: 'race-link',
			},
		);

		await waitUntil(() => hasLockWaiter('sponsorship'), 'the delivery to wait on sponsorship');

		let linked = false;
		const link = internalAdapter
			.linkAccount({ userId, providerId: 'github', accountId: githubId, accessToken: 'race' })
			.then(() => {
				linked = true;
			});

		await waitUntil(
			async () => linked || (await hasLockWaiter('account')),
			'the link to commit or wait',
		);

		const checkpoint = await latestMemberSeq();

		release.resolve();
		await blocker;

		expect(await statusOf(await delivery)).toEqual({ code: 200, body: { status: 'applied' } });

		await link;

		expect(await memberSeq(userId)).toBeGreaterThan(checkpoint);
	});

	test('a link in flight when a delivery starts is seen by the delivery', async () => {
		const githubId = '7701';
		const { userId } = await signInWithDiscord(ctx, {
			id: snowflakeAt(new Date('2021-01-02T00:00:00Z')),
			name: 'In-flight sponsor',
			email: 'in-flight-sponsor@example.com',
		});
		const inserted = Promise.withResolvers<number>();
		const release = Promise.withResolvers<void>();

		const link = ctx.db.transaction(async (tx) => {
			await tx.insert(account).values({
				id: 'in-flight-link',
				accountId: githubId,
				providerId: 'github',
				userId,
				updatedAt: new Date(),
			});
			inserted.resolve(await memberSeq(userId, tx));
			await release.promise;
		});
		const linkSeq = await inserted.promise;

		let delivered = false;
		const delivery = deliver(
			ctx,
			sponsorshipPayload({ action: 'created', sponsorId: githubId }),
			{
				id: 'in-flight-link',
			},
		).then((response) => {
			delivered = true;

			return response;
		});

		await waitUntil(
			async () => delivered || (await hasLockWaiter('account')),
			'the delivery to finish or wait on account',
		);
		release.resolve();
		await link;

		expect(await statusOf(await delivery)).toEqual({ code: 200, body: { status: 'applied' } });
		expect(await memberSeq(userId)).toBeGreaterThan(linkSeq);
	});
});

describe('sponsorship writes', () => {
	test('accept only a transaction that locked account first', () => {
		function plain(row: Sponsorship) {
			// @ts-expect-error A plain transaction skips the account lock the sponsorship feed trigger needs.
			return ctx.db.transaction((tx) => upsertSponsorship(tx, row));
		}

		expect(plain).toBeFunction();
	});
});

describe('webhook racing a user deletion', () => {
	type Attempts = { count: number };

	function countingAttempts(db: Database, attempts: Attempts): Database {
		function transaction<T>(body: TransactionBody<T>): Promise<T> {
			return db.transaction((tx) => {
				attempts.count++;

				return body(tx);
			});
		}

		return new Proxy(db, {
			get: (target, key) => (key === 'transaction' ? transaction : Reflect.get(target, key)),
		});
	}

	async function lockWaiters(): Promise<number> {
		const [row] = await ctx.db.$client<{ waiting: number }[]>`
			select count(*)::int as waiting from pg_locks
			where not granted
				and database = (select oid from pg_database where datname = current_database())`;

		return row?.waiting ?? 0;
	}

	test('a delivery and a deletion both waiting on the ordering lock do not deadlock', async () => {
		const githubId = '7800';
		const deleted = await signInWithDiscord(ctx, {
			id: snowflakeAt(new Date('2021-01-03T00:00:00Z')),
			name: 'Deleted user',
			email: 'deleted-user@example.com',
		});
		const sponsor = await signInWithDiscord(ctx, {
			id: snowflakeAt(new Date('2021-01-04T00:00:00Z')),
			name: 'Deadlock sponsor',
			email: 'deadlock-sponsor@example.com',
		});
		const { internalAdapter } = await ctx.auth.$context;

		await internalAdapter.linkAccount({
			userId: sponsor.userId,
			providerId: 'github',
			accountId: githubId,
			accessToken: 'deadlock',
		});

		const attempts = { count: 0 };
		const db = countingAttempts(ctx.db, attempts);
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();

		// Holding the ordering lock parks the deletion at its event, then the delivery behind it.
		const blocker = ctx.db.$client.begin(async (sql) => {
			await sql`select lock_ordered_ids()`;
			locked.resolve();
			await release.promise;
		});

		await locked.promise;

		const deletion = deleteUserWithRecord(db, deleted.userId, { actorId: null, at: NOW });

		await waitUntil(async () => (await lockWaiters()) === 1, 'the deletion to wait');

		const delivery = deliver(
			{ ...ctx, db },
			sponsorshipPayload({ action: 'created', sponsorId: githubId }),
			{ id: 'race-delete' },
		);

		await waitUntil(async () => (await lockWaiters()) === 2, 'the delivery to wait');
		release.resolve();
		await blocker;
		await deletion;

		expect(await statusOf(await delivery)).toEqual({ code: 200, body: { status: 'applied' } });
		expect(attempts.count).toBe(2);
	});
});
