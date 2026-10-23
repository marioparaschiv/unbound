import type { SponsorshipState } from '@unbound-app/contracts/sponsors';

import type { sponsorship } from '~/db/schema';

export type Sponsorship = typeof sponsorship.$inferSelect;

/** A standing that still carries perks. */
export type SponsoringStanding =
	| { kind: 'active'; sponsorship: Sponsorship }
	| { kind: 'grace'; sponsorship: Sponsorship; until: Date };

/** Where a sponsor stands at a moment: perks follow `active` and `grace`, never `lapsed`. */
export type SponsorStanding =
	| { kind: 'none' }
	| SponsoringStanding
	| { kind: 'lapsed'; sponsorship: Sponsorship };

// When each state stops counting as active; `null` while it still runs.
const ENDS_AT: Record<SponsorshipState, (row: Sponsorship) => Date | null> = {
	active: () => null,
	pending_cancellation: (row) => row.endsAt,
	cancelled: (row) => row.endsAt ?? row.updatedAt,
};

/**
 * @description Derives a sponsor's standing at a moment from their stored sponsorship.
 * @param row The sponsorship, or `undefined` when there is none.
 * @param now The moment to judge at.
 * @param graceMs How long perks outlast the end of a sponsorship.
 * @returns The standing.
 */
export function standingOf(
	row: Sponsorship | undefined,
	now: Date,
	graceMs: number,
): SponsorStanding {
	if (!row) {
		return { kind: 'none' };
	}

	const endsAt = ENDS_AT[row.state](row);

	if (!endsAt || now < endsAt) {
		return { kind: 'active', sponsorship: row };
	}

	const until = new Date(endsAt.getTime() + graceMs);

	if (now < until) {
		return { kind: 'grace', sponsorship: row, until };
	}

	return { kind: 'lapsed', sponsorship: row };
}

/**
 * @description Narrows a standing to one that still carries perks.
 * @param standing The standing.
 * @returns Whether the sponsor is active or within the grace period.
 */
export function isSponsoring(standing: SponsorStanding): standing is SponsoringStanding {
	return standing.kind === 'active' || standing.kind === 'grace';
}

export default { standingOf, isSponsoring };
