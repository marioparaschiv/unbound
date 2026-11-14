const EXPIRY_PATTERN = /\bexp (\d{4}-\d{2}-\d{2})\b/;
const DAY_MS = 86_400_000;

/** How many days before the signing profile expires the warning starts. */
export const PROFILE_WARNING_DAYS = 7;

/**
 * @description Reads the signing profile's expiry date from the loader's install details, such as `Development (`T`) · exp 2027-09-16`.
 * @param details The install details.
 * @returns The date as `YYYY-MM-DD`, or `undefined` for store installs and loaders that do not report it.
 */
export function profileExpiry(details: string): string | undefined {
	return EXPIRY_PATTERN.exec(details)?.[1];
}

/**
 * @description Counts the whole days left before a profile expiring on `expiry` stops the app opening, at the end of that day in UTC.
 * @param expiry The expiry date as `YYYY-MM-DD`.
 * @param now The current time.
 * @returns The days left, `0` on the last day, negative once it has expired.
 */
export function daysUntilExpiry(expiry: string, now = Date.now()): number {
	return Math.floor((Date.parse(`${expiry}T23:59:59Z`) - now) / DAY_MS);
}

/**
 * @description Decides whether to warn about an expiring profile: within {@link PROFILE_WARNING_DAYS}, at most once per day.
 * @param daysLeft The days left before it expires.
 * @param today Today's date as `YYYY-MM-DD`.
 * @param lastWarned The date of the last warning, empty when never warned.
 * @returns Whether to warn now.
 */
export function shouldWarnAboutExpiry(
	daysLeft: number,
	today: string,
	lastWarned: string,
): boolean {
	return daysLeft >= 0 && daysLeft <= PROFILE_WARNING_DAYS && lastWarned !== today;
}

export default profileExpiry;
