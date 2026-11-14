const CLOCK_URL = 'https://discord.com/api/v9/users/@me';
const CLOCK_TIMEOUT_MS = 3000;
const DATE_HEADER_RESOLUTION_MS = 500;

/**
 * @description Formats the device's offset from UTC, which `/debug` reports instead of the time zone name.
 * @param date The moment to read the offset at.
 * @returns The offset, such as `UTC+01:00`.
 */
export function utcOffset(date = new Date()): string {
	const minutes = -date.getTimezoneOffset();
	const sign = minutes < 0 ? '-' : '+';
	const hours = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0');
	const rest = String(Math.abs(minutes) % 60).padStart(2, '0');

	return `UTC${sign}${hours}:${rest}`;
}

/**
 * @description Works out how far the device clock is from a server's, from the request's start, end and `Date` header.
 * @param sentAt When the request left, by the device clock.
 * @param receivedAt When the response arrived, by the device clock.
 * @param header The response's `Date` header.
 * @returns Seconds the device runs ahead (negative when behind), or `undefined` for a missing or unreadable header.
 */
export function clockSkew(
	sentAt: number,
	receivedAt: number,
	header: string | null,
): number | undefined {
	const server = header ? Date.parse(header) : Number.NaN;

	if (Number.isNaN(server)) {
		return undefined;
	}

	return Math.round(((sentAt + receivedAt) / 2 - (server + DATE_HEADER_RESOLUTION_MS)) / 1000);
}

/**
 * @description Measures the device clock against Discord's, from an uncached request, since a wrong clock breaks TLS and signature checks.
 * @returns Seconds the device runs ahead (negative when behind), or `undefined` when Discord cannot be reached in time.
 */
export async function readClockSkew(): Promise<number | undefined> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), CLOCK_TIMEOUT_MS);
	const sentAt = Date.now();

	try {
		const response = await fetch(CLOCK_URL, {
			method: 'HEAD',
			cache: 'no-store',
			signal: controller.signal,
		});

		return clockSkew(sentAt, Date.now(), response.headers.get('date'));
	} catch {
		return undefined;
	} finally {
		clearTimeout(timeout);
	}
}

export default readClockSkew;
