import { and, eq, inArray } from 'drizzle-orm';

import { isSponsoring, perkGraceMs, standingOf } from '~/lib/sponsors/standing';
import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { account, sponsorship } from '~/db/schema';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

export type SponsorshipValues = Pick<
	Sponsorship,
	'githubId' | 'githubLogin' | 'tierName' | 'monthlyPriceCents' | 'oneTime' | 'isPublic' | 'since'
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

/**
 * @description Finds which users sponsor publicly now: their linked GitHub sponsorship is active or in
 * grace, at any tier, and GitHub lists it as public.
 * @param ctx The application context.
 * @param userIds The users.
 * @returns The ids of those who do.
 */
export async function getPublicSponsors(ctx: AppContext, userIds: string[]): Promise<Set<string>> {
	if (userIds.length === 0) {
		return new Set();
	}

	const now = ctx.now();
	const rows = await ctx.db
		.select({ userId: account.userId, sponsorship })
		.from(account)
		.innerJoin(sponsorship, eq(sponsorship.githubId, account.accountId))
		.where(
			and(
				inArray(account.userId, userIds),
				eq(account.providerId, 'github'),
				eq(sponsorship.isPublic, true),
			),
		);

	return new Set(
		rows
			.filter((row) => isSponsoring(standingOf(row.sponsorship, now, graceMs(ctx.env))))
			.map((row) => row.userId),
	);
}

export default { graceMs, upsertSponsorship, getUserSponsorship, getPublicSponsors };
