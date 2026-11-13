import { getSetting, setSetting } from '~/settings/unbound';

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

export default { newListingsSince, resetNewListingsSince };
