import type { BadgeClaim, PerkId } from '@unbound-app/contracts/sponsors';
import { perkIdSchema } from '@unbound-app/contracts/sponsors';

import type { SponsorStanding, Sponsorship } from '~/lib/sponsors/standing';
import { findBadgeClaim, toBadgeClaim } from '~/lib/sponsors/badges';
import { getUserSponsorship } from '~/lib/sponsors/sponsorships';
import { isPerkUnlocked, PERKS } from '~/lib/sponsors/perks';
import type { AppContext } from '~/lib/context';

export type PerkStatus = {
	id: PerkId;
	name: string;
	description: string;
	unlocked: boolean;
};

export type SponsorOverview = {
	/** The sponsored account's GitHub Sponsors page, or `null` when Sponsors is not configured. */
	sponsorUrl: string | null;
	githubLinked: boolean;
	sponsorship: Omit<Sponsorship, 'githubId' | 'githubLogin' | 'updatedAt'> | null;
	standing: SponsorStanding['kind'];
	/** When perks stop, while the sponsorship has ended but the grace period has not. */
	graceUntil: Date | null;
	perks: PerkStatus[];
	badge: BadgeClaim | null;
};

/**
 * @description Loads what `/account` shows about a user's sponsorship and the perks it unlocks.
 * @param ctx The application context.
 * @param userId The user.
 * @returns The overview.
 */
export function getSponsorOverview(ctx: AppContext, userId: string): SponsorOverview {
	const login = ctx.env.GITHUB_SPONSORS_LOGIN;
	const { githubLinked, standing } = getUserSponsorship(ctx, userId);
	const row = standing.kind === 'none' ? undefined : standing.sponsorship;
	const perks = perkIdSchema.options.map((id) => ({
		id,
		name: PERKS[id].name,
		description: PERKS[id].description,
		unlocked: isPerkUnlocked(id, standing),
	}));

	return {
		sponsorUrl: login ? `https://github.com/sponsors/${encodeURIComponent(login)}` : null,
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
		badge: toBadgeClaim(findBadgeClaim(ctx, userId)),
	};
}

export default { getSponsorOverview };
