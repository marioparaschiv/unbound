import { and, eq, sql } from 'drizzle-orm';

import type { Database, Transaction, TransactionBody } from '~/db/database';
import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { standingOf } from '~/lib/sponsors/standing';
import { account, sponsorship } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SponsorshipValues = Pick<
	Sponsorship,
	'githubId' | 'githubLogin' | 'tierName' | 'monthlyPriceCents' | 'oneTime' | 'since'
>;

export type SponsorshipLifecycle = Pick<Sponsorship, 'state' | 'endsAt'>;

export type UserSponsorship = {
	githubLinked: boolean;
	standing: SponsorStanding;
};

/**
 * @description Reads how long perks outlast a sponsorship.
 * @param env The validated environment.
 * @returns The grace period in milliseconds.
 */
export function graceMs(env: Env): number {
	return env.SPONSOR_PERK_GRACE_DAYS * DAY_MS;
}

/**
 * @description Runs a transaction that writes sponsorships, holding `account` in SHARE mode from
 * before its snapshot so the sponsorship feed trigger sees every GitHub link committed before it.
 * @template T The body's result.
 * @param db The database.
 * @param body The transaction body.
 * @returns The body's result.
 */
export function sponsorshipTransaction<T>(db: Database, body: TransactionBody<T>): Promise<T> {
	return db.transaction(async (tx) => {
		// LOCK takes no snapshot, so it must be the first statement. A link in flight commits before the
		// snapshot; a later one waits for this commit and its own trigger moves the member after it.
		await tx.execute(sql`lock table ${account} in share mode`);

		return body(tx);
	});
}

/**
 * @description Inserts a sponsorship or replaces the stored one for the same GitHub id.
 * @param tx The transaction to write in.
 * @param row The whole sponsorship.
 * @returns Resolves once it is written.
 */
export async function upsertSponsorship(tx: Transaction, row: Sponsorship): Promise<void> {
	const { githubId: _githubId, ...values } = row;

	await tx
		.insert(sponsorship)
		.values(row)
		.onConflictDoUpdate({ target: sponsorship.githubId, set: values });
}

/**
 * @description Finds a user's sponsorship through their linked GitHub account and judges it now.
 * @param ctx The application context.
 * @param userId The user.
 * @returns Whether GitHub is linked and the user's standing.
 */
export async function getUserSponsorship(
	ctx: AppContext,
	userId: string,
): Promise<UserSponsorship> {
	const [row] = await ctx.db
		.select({ sponsorship })
		.from(account)
		.leftJoin(sponsorship, eq(sponsorship.githubId, account.accountId))
		.where(and(eq(account.userId, userId), eq(account.providerId, 'github')));

	return {
		githubLinked: Boolean(row),
		standing: standingOf(row?.sponsorship ?? undefined, ctx.now(), graceMs(ctx.env)),
	};
}

export default { graceMs, sponsorshipTransaction, upsertSponsorship, getUserSponsorship };
