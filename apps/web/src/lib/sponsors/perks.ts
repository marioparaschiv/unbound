import type { PerkId } from '@unbound-app/contracts/sponsors';
import { badgeSchema } from '@unbound-app/contracts/sponsors';
import type { z } from 'zod';

import type { SponsorStanding } from '~/lib/sponsors/standing';
import { isSponsoring } from '~/lib/sponsors/standing';

export type PerkDefinition = {
	name: string;
	description: string;
	/** Whether a standing unlocks the perk; claiming or editing additionally needs `active`. */
	eligible: (standing: SponsorStanding) => boolean;
	/** What the owner sets up, stored as the claim's `config`. */
	config: z.ZodType;
};

/**
 * @description Builds the eligibility rule for a perk any recurring tier of at least an amount unlocks.
 * @param cents The smallest monthly price, in cents.
 * @returns The eligibility rule.
 */
export function monthlyTierFrom(cents: number): PerkDefinition['eligible'] {
	return (standing) =>
		isSponsoring(standing) &&
		!standing.sponsorship.oneTime &&
		standing.sponsorship.monthlyPriceCents >= cents;
}

/** Every perk; adding one needs an entry here and nothing in the schema. */
export const PERKS = {
	'custom-badge': {
		name: 'Custom badge',
		description: 'A badge of your own next to your name on developer and addon pages.',
		eligible: monthlyTierFrom(100),
		config: badgeSchema,
	},
} satisfies Record<PerkId, PerkDefinition>;

/**
 * @description Checks whether a standing unlocks a perk.
 * @param perkId The perk.
 * @param standing The sponsor's standing.
 * @returns Whether the perk is unlocked.
 */
export function isPerkUnlocked(perkId: PerkId, standing: SponsorStanding): boolean {
	return PERKS[perkId].eligible(standing);
}

export default { PERKS, monthlyTierFrom, isPerkUnlocked };
