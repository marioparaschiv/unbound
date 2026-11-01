import type { PerkId } from '@unbound-app/contracts/sponsors';
import { badgeSchema } from '@unbound-app/contracts/sponsors';
import type { z } from 'zod';

import type { SponsorStanding } from '~/lib/sponsors/standing';
import { isSponsoring } from '~/lib/sponsors/standing';

export type PerkDefinition = {
	name: string;
	description: string;
	/** The smallest recurring monthly tier that unlocks the perk, in cents. */
	minimumMonthlyCents: number;
	config: z.ZodType;
};

export const PERKS = {
	'custom-badge': {
		name: 'Custom badge',
		description:
			'A badge of your own on your Discord profile, shown to everyone using Unbound.',
		minimumMonthlyCents: 500,
		config: badgeSchema,
	},
} satisfies Record<PerkId, PerkDefinition>;

/**
 * @description Checks whether a standing unlocks a perk: a recurring tier of at least the perk's minimum.
 * @param perkId The perk.
 * @param standing The sponsor's standing.
 * @returns Whether the perk is unlocked.
 */
export function isPerkUnlocked(perkId: PerkId, standing: SponsorStanding): boolean {
	return (
		isSponsoring(standing) &&
		!standing.sponsorship.oneTime &&
		standing.sponsorship.monthlyPriceCents >= PERKS[perkId].minimumMonthlyCents
	);
}

/**
 * @description Checks whether a standing lets the sponsor set up or change a perk. The grace period
 * only keeps a perk already set up, so this needs an active sponsorship.
 * @param perkId The perk.
 * @param standing The sponsor's standing.
 * @returns Whether the perk can be claimed.
 */
export function canClaimPerk(perkId: PerkId, standing: SponsorStanding): boolean {
	return standing.kind === 'active' && isPerkUnlocked(perkId, standing);
}

export default { PERKS, isPerkUnlocked, canClaimPerk };
