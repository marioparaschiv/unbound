import { BADGE_LIMIT, badgesSchema } from '@unbound-app/contracts/sponsors';
import type { PerkId } from '@unbound-app/contracts/sponsors';
import type { TSchema } from '@unbound-app/contracts/schema';

import type { SponsorStanding } from '~/lib/sponsors/standing';
import { isSponsoring } from '~/lib/sponsors/standing';
import { hasPermission } from '~/lib/auth/access';

export type PerkDefinition = {
	name: string;
	description: string;
	/** The smallest recurring monthly tier that unlocks the perk, in cents. */
	minimumMonthlyCents: number;
	/** The smallest one-time payment that unlocks the perk for good, in cents. */
	minimumOneTimeCents: number;
	config: TSchema;
};

export const PERKS = {
	'custom-badge': {
		name: 'Custom badge',
		description:
			'A badge of your own on your Discord profile, shown to everyone using Unbound. Animated GIFs work too.',
		minimumMonthlyCents: 500,
		minimumOneTimeCents: 3000,
		config: badgesSchema,
	},
} satisfies Record<PerkId, PerkDefinition>;

/** Badges each recurring tier allows, highest first, as the GitHub Sponsors tier descriptions promise. */
const MONTHLY_BADGE_TIERS = [
	{ minimumMonthlyCents: 2000, badges: BADGE_LIMIT },
	{ minimumMonthlyCents: 1000, badges: 2 },
	{ minimumMonthlyCents: 500, badges: 1 },
];

/**
 * @description Checks whether a sponsor ever made a one-time payment large enough to keep a perk for good.
 * @param perkId The perk.
 * @param standing The sponsor's standing, lapsed ones included.
 * @returns Whether the perk is permanently unlocked.
 */
export function isPerkPermanent(perkId: PerkId, standing: SponsorStanding): boolean {
	return (
		standing.kind !== 'none' &&
		standing.sponsorship.largestOneTimeCents >= PERKS[perkId].minimumOneTimeCents
	);
}

/**
 * @description Checks whether a standing unlocks a perk: a recurring tier of at least the perk's monthly
 * minimum, or a one-time payment ever of at least its one-time minimum.
 * @param perkId The perk.
 * @param standing The sponsor's standing.
 * @returns Whether the perk is unlocked.
 */
export function isPerkUnlocked(perkId: PerkId, standing: SponsorStanding): boolean {
	return (
		isPerkPermanent(perkId, standing) ||
		(isSponsoring(standing) &&
			!standing.sponsorship.oneTime &&
			standing.sponsorship.monthlyPriceCents >= PERKS[perkId].minimumMonthlyCents)
	);
}

/**
 * @description Checks whether a standing lets the sponsor set up or change a perk. The grace period
 * only keeps a perk already set up, so this needs an active sponsorship or a permanent unlock.
 * @param perkId The perk.
 * @param standing The sponsor's standing.
 * @returns Whether the perk can be claimed.
 */
export function canClaimPerk(perkId: PerkId, standing: SponsorStanding): boolean {
	return (
		isPerkPermanent(perkId, standing) ||
		(standing.kind === 'active' && isPerkUnlocked(perkId, standing))
	);
}

/**
 * @description Counts the badges a sponsor may set and show: the best of their recurring tier, while it
 * lasts, and one permanent badge per one-time minimum in their largest one-time payment. Staff get the most.
 * @param standing The sponsor's standing.
 * @param role The user's `role` column.
 * @returns How many badges are allowed; 0 when the perk is locked.
 */
export function getBadgeLimit(standing: SponsorStanding, role: string | null | undefined): number {
	if (roleGrantsPerks(role)) {
		return BADGE_LIMIT;
	}

	const permanent =
		standing.kind === 'none'
			? 0
			: Math.floor(
					standing.sponsorship.largestOneTimeCents /
						PERKS['custom-badge'].minimumOneTimeCents,
				);
	const monthly =
		isSponsoring(standing) && !standing.sponsorship.oneTime
			? (MONTHLY_BADGE_TIERS.find(
					(tier) => standing.sponsorship.monthlyPriceCents >= tier.minimumMonthlyCents,
				)?.badges ?? 0)
			: 0;

	return Math.min(BADGE_LIMIT, Math.max(permanent, monthly));
}

/**
 * @description Checks whether a role grants every perk without a sponsorship, as staff roles do.
 * @param role The user's `role` column.
 * @returns Whether the role grants perks.
 */
export function roleGrantsPerks(role: string | null | undefined): boolean {
	return hasPermission(role, { perk: ['claim'] });
}

export default {
	PERKS,
	isPerkPermanent,
	isPerkUnlocked,
	canClaimPerk,
	getBadgeLimit,
	roleGrantsPerks,
};
