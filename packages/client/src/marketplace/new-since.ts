import type { ListedAddon } from '@unbound-app/contracts/addons';

import { getSetting, setSetting } from '~/settings/unbound';
import { isNewListing } from '~/marketplace/catalog';

const DAY_MS = 86_400_000;
const FIRST_VISIT_DAYS = 3;

let since: number | undefined;

/**
 * @description Reads when the user last opened the marketplace, before this session, and records this visit, so the
 * New badge marks only addons listed since then. The first call of a session decides; later calls return the same time.
 * @param now The current time in milliseconds.
 * @returns The time addons must be listed after to count as new; three days ago on the first visit ever.
 */
export function newListingsSince(now: number = Date.now()): number {
	if (since !== undefined) {
		return since;
	}

	const last = getSetting('marketplace.lastVisit');

	since = last > 0 ? last : now - FIRST_VISIT_DAYS * DAY_MS;
	setSetting('marketplace.lastVisit', now);

	return since;
}

/**
 * @description Forgets this session's visit, so the next call reads the stored one again. Tests only.
 */
export function resetNewListingsSince(): void {
	since = undefined;
}

/**
 * @description Tells whether an addon is new to this user: listed since their last marketplace visit and within the New window.
 * @param addon The listed addon.
 * @returns Whether its card shows the New badge.
 */
export function isNewToUser(addon: ListedAddon): boolean {
	const now = Date.now();

	return isNewListing(addon, now, newListingsSince(now));
}

export default { newListingsSince, resetNewListingsSince, isNewToUser };
