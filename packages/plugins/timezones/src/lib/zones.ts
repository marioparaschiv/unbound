export type Clock = 'device' | 'h12' | 'h24';

export type SeenClock = 'unknown' | 'h12' | 'h24';

const SEPARATOR = '=';
const TWELVE_HOUR = /\d\s?[ap]\.?\s?m\.?/i;

/**
 * @description Reads which clock Discord writes a timestamp on; Hermes ignores the device's own 24-hour preference, so Discord's timestamps tell it.
 * @param timestamp A timestamp Discord wrote, such as `09:03` or `9:03 AM`.
 * @returns The clock.
 */
export function clockOf(timestamp: string): Exclude<SeenClock, 'unknown'> {
	return TWELVE_HOUR.test(timestamp) ? 'h12' : 'h24';
}

/**
 * @description Decides whether a clock setting writes 12-hour times.
 * @param clock The setting.
 * @param seen The clock Discord was last seen writing.
 * @returns `true` or `false`, or `undefined` to leave it to the locale.
 */
export function twelveHour(clock: Clock, seen: SeenClock): boolean | undefined {
	const used = clock === 'device' ? seen : clock;

	return used === 'unknown' ? undefined : used === 'h12';
}

/**
 * @description Checks a timezone name against the device's timezone data.
 * @param zone An IANA name, such as `Europe/Berlin`.
 * @returns Whether the device can format times in it.
 */
export function isTimezone(zone: string): boolean {
	if (!zone.trim()) return false;

	try {
		new Intl.DateTimeFormat(undefined, { timeZone: zone.trim() });

		return true;
	} catch {
		return false;
	}
}

/**
 * @description Writes a moment's time of day in a timezone.
 * @param moment The moment.
 * @param zone The timezone.
 * @param hour12 Whether to write a 12-hour time, or `undefined` to leave it to the locale.
 * @param locale The language, the device's own by default.
 * @returns The time, such as `14:05` or `2:05 PM`.
 */
export function timeIn(moment: Date, zone: string, hour12?: boolean, locale?: string): string {
	return moment.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: zone,
		...(hour12 === undefined ? {} : { hour12 }),
	});
}

/**
 * @description Works out a timezone's offset from UTC at a moment, in minutes.
 * @param moment The moment.
 * @param zone The timezone.
 * @returns The offset, east of UTC positive.
 */
export function offsetMinutes(moment: Date, zone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: zone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).formatToParts(moment);
	const field = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);
	const local = Date.UTC(
		field('year'),
		field('month') - 1,
		field('day'),
		field('hour') % 24,
		field('minute'),
	);
	const utc = Math.floor(moment.getTime() / 60_000) * 60_000;

	return Math.round((local - utc) / 60_000);
}

/**
 * @description Reads the timezones set by hand from their stored `userId=zone` entries.
 * @param entries The stored entries.
 * @returns The timezone set for each user.
 */
export function readChosen(entries: readonly string[]): Map<string, string> {
	return new Map(
		entries.flatMap((entry) => {
			const at = entry.indexOf(SEPARATOR);

			return at > 0 ? [[entry.slice(0, at), entry.slice(at + 1)] as const] : [];
		}),
	);
}

/**
 * @description Sets or clears one user's timezone in the stored entries.
 * @param entries The stored entries.
 * @param userId The user.
 * @param zone The timezone, or `undefined` to clear it.
 * @returns The new entries.
 */
export function withChosen(
	entries: readonly string[],
	userId: string,
	zone: string | undefined,
): string[] {
	const kept = entries.filter((entry) => !entry.startsWith(`${userId}${SEPARATOR}`));

	return zone ? [...kept, `${userId}${SEPARATOR}${zone.trim()}`] : kept;
}

export default {
	clockOf,
	twelveHour,
	isTimezone,
	timeIn,
	offsetMinutes,
	readChosen,
	withChosen,
};
