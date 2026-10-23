import { and, eq } from 'drizzle-orm';

import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { standingOf } from '~/lib/sponsors/standing';
import { account, sponsorship } from '~/db/schema';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What GitHub reports about a sponsorship, from a webhook or the GraphQL API. */
export type SponsorshipValues = Pick<
	Sponsorship,
	'githubId' | 'githubLogin' | 'tierName' | 'monthlyPriceCents' | 'oneTime' | 'since'
>;

/** Where a sponsorship is in its life, which webhooks and reconciliation decide. */
export type SponsorshipLifecycle = Pick<Sponsorship, 'state' | 'endsAt'>;

export type UserSponsorship = {
	/** Whether the user has linked a GitHub account, which is how a sponsorship reaches them. */
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
 * @description Inserts a sponsorship or replaces the stored one for the same GitHub id.
 * @param tx The transaction to write in.
 * @param row The whole sponsorship.
 */
export function upsertSponsorship(tx: Transaction, row: Sponsorship) {
	const { githubId: _githubId, ...values } = row;

	tx.insert(sponsorship)
		.values(row)
		.onConflictDoUpdate({ target: sponsorship.githubId, set: values })
		.run();
}

/**
 * @description Finds a user's sponsorship through their linked GitHub account and judges it now.
 * @param ctx The application context.
 * @param userId The user.
 * @returns Whether GitHub is linked and the user's standing.
 */
export function getUserSponsorship(ctx: AppContext, userId: string): UserSponsorship {
	const row = ctx.db
		.select({ sponsorship })
		.from(account)
		.leftJoin(sponsorship, eq(sponsorship.githubId, account.accountId))
		.where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
		.get();

	return {
		githubLinked: Boolean(row),
		standing: standingOf(row?.sponsorship ?? undefined, ctx.now(), graceMs(ctx.env)),
	};
}

export default { graceMs, upsertSponsorship, getUserSponsorship };
