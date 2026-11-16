const COMMON_TIMEZONES = [
	'UTC',
	'Europe/London',
	'Europe/Dublin',
	'Europe/Lisbon',
	'Europe/Paris',
	'Europe/Berlin',
	'Europe/Madrid',
	'Europe/Rome',
	'Europe/Amsterdam',
	'Europe/Stockholm',
	'Europe/Warsaw',
	'Europe/Athens',
	'Europe/Helsinki',
	'Europe/Istanbul',
	'Europe/Moscow',
	'Africa/Cairo',
	'Africa/Johannesburg',
	'Africa/Lagos',
	'Asia/Dubai',
	'Asia/Karachi',
	'Asia/Kolkata',
	'Asia/Dhaka',
	'Asia/Bangkok',
	'Asia/Jakarta',
	'Asia/Singapore',
	'Asia/Manila',
	'Asia/Shanghai',
	'Asia/Hong_Kong',
	'Asia/Taipei',
	'Asia/Seoul',
	'Asia/Tokyo',
	'Australia/Perth',
	'Australia/Adelaide',
	'Australia/Brisbane',
	'Australia/Sydney',
	'Pacific/Auckland',
	'Pacific/Honolulu',
	'America/Anchorage',
	'America/Los_Angeles',
	'America/Denver',
	'America/Phoenix',
	'America/Chicago',
	'America/Mexico_City',
	'America/New_York',
	'America/Toronto',
	'America/Bogota',
	'America/Lima',
	'America/Santiago',
	'America/Sao_Paulo',
	'America/Argentina/Buenos_Aires',
];

/**
 * @description The device's own timezone.
 * @returns Its IANA name, such as `Europe/Berlin`.
 */
export function deviceTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * @description Whether a name is a timezone this device knows.
 * @param name The name to check.
 * @returns The timezone's canonical name, or `undefined` when there is none.
 */
export function knownTimezone(name: string): string | undefined {
	try {
		return new Intl.DateTimeFormat('en-US', { timeZone: name.trim() }).resolvedOptions()
			.timeZone;
	} catch {
		return undefined;
	}
}

/**
 * @description Suggests timezones for what the user typed: the device's own first, then common ones that contain it.
 * @param query What the user typed.
 * @returns At most 25 names.
 */
export function suggestTimezones(query: string): string[] {
	const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
	const names = [...new Set([deviceTimezone(), ...COMMON_TIMEZONES])];

	return names.filter((name) => name.toLowerCase().includes(needle)).slice(0, 25);
}

export default { deviceTimezone, knownTimezone, suggestTimezones };
