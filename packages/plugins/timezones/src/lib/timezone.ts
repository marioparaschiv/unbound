import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import type { TimezoneLookup } from '~/lib/lookup';

import { readChosen } from '~/lib/zones';

let lookup: TimezoneLookup | undefined;

/**
 * @description Sets the TimezoneDB lookup that timezones fall back to, or removes it.
 * @param next The lookup, or `undefined` to stop looking timezones up.
 */
export function useLookup(next: TimezoneLookup | undefined): void {
	lookup?.dispose();
	lookup = next;
}

/**
 * @description The device's own timezone.
 * @returns Its IANA name.
 */
export function deviceTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * @description Finds a user's timezone: one set by hand first, then TimezoneDB, and the device's own for the current user.
 * @param userId The user.
 * @returns The timezone, or `undefined` while it is unknown.
 */
export function timezoneOf(userId: string): string | undefined {
	const chosen = readChosen(settings.chosen).get(userId);

	if (chosen) return chosen;

	const shared = settings.database ? lookup?.get(userId) : undefined;

	if (shared) return shared;

	return userId === flux.getStore('User').getCurrentUser()?.id ? deviceTimezone() : undefined;
}

/**
 * @description Whether a user's local time shows, which hides the current user's when they turned that off.
 * @param userId The user.
 * @returns Whether it shows.
 */
export function showsFor(userId: string): boolean {
	return settings.showOwn || userId !== flux.getStore('User').getCurrentUser()?.id;
}

export default { useLookup, deviceTimezone, timezoneOf, showsFor };
