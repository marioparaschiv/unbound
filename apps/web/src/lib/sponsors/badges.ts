import type {
	Badge,
	BadgeClaim,
	BadgeClaimResponse,
	PublicBadge,
} from '@unbound-app/contracts/sponsors';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import { canClaimPerk, isPerkUnlocked, PERKS } from '~/lib/sponsors/perks';
import { getUserSponsorship, graceMs } from '~/lib/sponsors/sponsorships';
import { account, perkClaim, sponsorship, user } from '~/db/schema';
import { findBadgeLabelProblem } from '~/lib/sponsors/moderation';
import { requirePermission } from '~/lib/api/caller';
import { standingOf } from '~/lib/sponsors/standing';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';

const logger = createLogger('Web', 'Sponsors');

const PERK_ID = 'custom-badge';

type ClaimRow = typeof perkClaim.$inferSelect;

function badgeClaimWhere(userId: string) {
	return and(eq(perkClaim.userId, userId), eq(perkClaim.perkId, PERK_ID));
}

function parseBadge(row: ClaimRow): Badge | undefined {
	const result = PERKS[PERK_ID].config.safeParse(row.config);

	if (!result.success) {
		logger.warn(`Ignoring the unreadable ${PERK_ID} of ${row.userId}:`, result.error);

		return;
	}

	return result.data;
}

/**
 * @description Shapes a stored badge claim for its owner or staff.
 * @param row The claim row, if any.
 * @returns The claim, or `null` when there is none or its config cannot be read.
 */
export function toBadgeClaim(row: ClaimRow | undefined): BadgeClaim | null {
	const badge = row ? parseBadge(row) : undefined;

	if (!row || !badge) return null;

	return {
		...badge,
		revokedAt: row.revokedAt?.toISOString() ?? null,
		revokeReason: row.revokeReason,
	};
}

/**
 * @description Reads a user's badge claim.
 * @param ctx The application context.
 * @param userId The user.
 * @returns The claim row, or `undefined`.
 */
export function findBadgeClaim(ctx: AppContext, userId: string): ClaimRow | undefined {
	return ctx.db.select().from(perkClaim).where(badgeClaimWhere(userId)).get();
}

function claimResponse(ctx: AppContext, userId: string): BadgeClaimResponse {
	return { claim: toBadgeClaim(findBadgeClaim(ctx, userId)) };
}

/**
 * @description Sets or changes the caller's custom badge. Needs an active sponsorship that unlocks it,
 * a claim staff have not revoked, and a label that passes moderation.
 * @param ctx The application context.
 * @param userId The badge owner.
 * @param badge The badge, already validated against the contract schema.
 * @returns The stored claim.
 */
export async function claimBadge(
	ctx: AppContext,
	userId: string,
	badge: Badge,
): Promise<BadgeClaimResponse> {
	const { standing } = getUserSponsorship(ctx, userId);

	if (!canClaimPerk(PERK_ID, standing)) {
		throw new ApiError(
			'sponsorship_required',
			'A monthly GitHub sponsorship of $1 or more unlocks a custom badge.',
		);
	}

	if (findBadgeClaim(ctx, userId)?.revokedAt) {
		throw new ApiError('perk_revoked', 'Staff removed your badge; it cannot be set again.');
	}

	const problem = findBadgeLabelProblem(badge.label);

	if (problem) {
		throw new ApiError('badge_rejected', problem);
	}

	const now = ctx.now();

	await ctx.db
		.insert(perkClaim)
		.values({ userId, perkId: PERK_ID, config: badge, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [perkClaim.userId, perkClaim.perkId],
			set: { config: badge, updatedAt: now },
		});

	return claimResponse(ctx, userId);
}

/**
 * @description Removes the caller's custom badge. A revoked one stays, so it cannot be set again.
 * @param ctx The application context.
 * @param userId The badge owner.
 * @returns The claim left, which is `null` unless it was revoked.
 */
export async function removeBadge(ctx: AppContext, userId: string): Promise<BadgeClaimResponse> {
	await ctx.db.delete(perkClaim).where(and(badgeClaimWhere(userId), isNull(perkClaim.revokedAt)));

	return claimResponse(ctx, userId);
}

/**
 * @description Hides a user's custom badge and stops them setting another. Requires `perk:revoke`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param userId The badge owner.
 * @param reason Why, shown to the owner.
 * @returns The revoked claim.
 */
export async function revokeBadge(
	ctx: AppContext,
	caller: Caller,
	userId: string,
	reason: string,
): Promise<BadgeClaimResponse> {
	requirePermission(caller, { perk: ['revoke'] });

	return setRevocation(ctx, userId, {
		revokedAt: ctx.now(),
		revokedBy: caller.user.id,
		revokeReason: reason,
	});
}

/**
 * @description Lifts a revocation, showing the badge again while the owner's sponsorship unlocks it.
 * Requires `perk:revoke`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param userId The badge owner.
 * @returns The restored claim.
 */
export async function restoreBadge(
	ctx: AppContext,
	caller: Caller,
	userId: string,
): Promise<BadgeClaimResponse> {
	requirePermission(caller, { perk: ['revoke'] });

	return setRevocation(ctx, userId, { revokedAt: null, revokedBy: null, revokeReason: null });
}

async function setRevocation(
	ctx: AppContext,
	userId: string,
	revocation: Pick<ClaimRow, 'revokedAt' | 'revokedBy' | 'revokeReason'>,
): Promise<BadgeClaimResponse> {
	const updated = await ctx.db
		.update(perkClaim)
		.set(revocation)
		.where(badgeClaimWhere(userId))
		.returning();

	if (updated.length === 0) {
		throw new ApiError('not_found', `${userId} has no badge.`);
	}

	return { claim: toBadgeClaim(updated[0]) };
}

/**
 * @description Finds the badges to show next to users' names: set, not revoked, owned by a user who
 * is not banned and whose linked GitHub sponsorship still unlocks it.
 * @param ctx The application context.
 * @param userIds The users.
 * @returns Each shown badge by user id.
 */
export async function getVisibleBadges(
	ctx: AppContext,
	userIds: string[],
): Promise<Map<string, PublicBadge>> {
	const badges = new Map<string, PublicBadge>();

	if (userIds.length === 0) {
		return badges;
	}

	const now = ctx.now();
	const rows = await ctx.db
		.select({ claim: perkClaim, sponsorship })
		.from(perkClaim)
		.innerJoin(user, eq(user.id, perkClaim.userId))
		.innerJoin(
			account,
			and(eq(account.userId, perkClaim.userId), eq(account.providerId, 'github')),
		)
		.innerJoin(sponsorship, eq(sponsorship.githubId, account.accountId))
		.where(
			and(
				inArray(perkClaim.userId, userIds),
				eq(perkClaim.perkId, PERK_ID),
				isNull(perkClaim.revokedAt),
				or(isNull(user.banned), eq(user.banned, false), lte(user.banExpires, now)),
			),
		);

	for (const row of rows) {
		const standing = standingOf(row.sponsorship, now, graceMs(ctx.env));
		const badge = isPerkUnlocked(PERK_ID, standing) ? parseBadge(row.claim) : undefined;

		if (!badge) {
			continue;
		}

		badges.set(row.claim.userId, { ...badge, kind: PERK_ID });
	}

	return badges;
}

export default {
	toBadgeClaim,
	findBadgeClaim,
	claimBadge,
	removeBadge,
	revokeBadge,
	restoreBadge,
	getVisibleBadges,
};
