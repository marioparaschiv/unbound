import type { BadgeClaim, PerkId } from '@unbound-app/contracts/sponsors';
import { perkIdSchema } from '@unbound-app/contracts/sponsors';

import { canClaimPerk, isPerkUnlocked, PERKS, roleGrantsPerks } from '~/lib/sponsors/perks';
import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { findBadgeClaim, toBadgeClaim } from '~/lib/sponsors/badges';
import { getUserSponsorship } from '~/lib/sponsors/sponsorships';
import type { AppContext } from '~/lib/context';

// The account in `.github/FUNDING.yml`, so the sponsor link shows before the sponsors integration is configured.
const DEFAULT_SPONSORS_LOGIN = 'marioparaschiv';

export type PerkStatus = {
	id: PerkId;
	name: string;
	description: string;
	/** The smallest recurring monthly tier that unlocks the perk, in cents. */
	minimumMonthlyCents: number;
	unlocked: boolean;
	/** Whether the user can set up or change the perk now, which a grace period alone does not allow. */
	claimable: boolean;
};

export type SponsorOverview = {
	sponsorUrl: string;
	githubLinked: boolean;
	sponsorship: Omit<Sponsorship, 'githubId' | 'githubLogin' | 'isPublic' | 'updatedAt'> | null;
	standing: SponsorStanding['kind'];
	graceUntil: Date | null;
	perks: PerkStatus[];
	badge: BadgeClaim | null;
};

/**
 * @description Loads what `/account` shows about a user's sponsorship and the perks it unlocks.
 * @param ctx The application context.
 * @param userId The user.
 * @param role The user's `role` column; staff roles unlock every perk without a sponsorship.
 * @returns The overview.
 */
export async function getSponsorOverview(
	ctx: AppContext,
	userId: string,
	role: string | null | undefined,
): Promise<SponsorOverview> {
	const granted = roleGrantsPerks(role);
	const [{ githubLinked, standing }, claim] = await Promise.all([
		getUserSponsorship(ctx, userId),
		findBadgeClaim(ctx, userId),
	]);
	const row = standing.kind === 'none' ? undefined : standing.sponsorship;
	const perks = perkIdSchema.enum.map((id) => ({
		id,
		name: PERKS[id].name,
		description: PERKS[id].description,
		minimumMonthlyCents: PERKS[id].minimumMonthlyCents,
		unlocked: granted || isPerkUnlocked(id, standing),
		claimable: granted || canClaimPerk(id, standing),
	}));

	return {
		sponsorUrl: `https://github.com/sponsors/${encodeURIComponent(ctx.env.GITHUB_SPONSORS_LOGIN ?? DEFAULT_SPONSORS_LOGIN)}`,
		githubLinked,
		sponsorship: row
			? {
					state: row.state,
					tierName: row.tierName,
					monthlyPriceCents: row.monthlyPriceCents,
					oneTime: row.oneTime,
					since: row.since,
					endsAt: row.endsAt,
				}
			: null,
		standing: standing.kind,
		graceUntil: standing.kind === 'grace' ? standing.until : null,
		perks,
		badge: toBadgeClaim(ctx.env, claim),
	};
}

export default { getSponsorOverview };
