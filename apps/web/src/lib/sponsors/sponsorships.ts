import { and, eq } from 'drizzle-orm';

import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import type { Transaction } from '~/db/database';
import { perkGraceMs, standingOf } from '~/lib/sponsors/standing';
import { account, sponsorship } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

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
	return perkGraceMs(env.SPONSOR_PERK_GRACE_DAYS);
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

export default { graceMs, upsertSponsorship, getUserSponsorship };
