/** A message a search returned: where and when it was sent. */
export type FoundMessage = { id: string; channelId: string; timestamp: number };

type SearchMessage = { id?: string; channel_id?: string; timestamp?: string };

type SearchBody = { messages?: SearchMessage[][] };

/**
 * @description Reads the newest message from a search response.
 * @param body The search's response body.
 * @returns The message, or `undefined` when the search found none.
 */
export function firstFound(body: SearchBody | undefined): FoundMessage | undefined {
	const [message] = body?.messages?.[0] ?? [];
	const timestamp = Date.parse(message?.timestamp ?? '');

	if (!message?.id || !message.channel_id || Number.isNaN(timestamp)) return;

	return { id: message.id, channelId: message.channel_id, timestamp };
}

/**
 * @description Picks the newer of two messages.
 * @param a One message, or none.
 * @param b The other, or none.
 * @returns The newer one.
 */
export function newer(
	a: FoundMessage | undefined,
	b: FoundMessage | undefined,
): FoundMessage | undefined {
	if (!a) return b;
	if (!b) return a;

	return b.timestamp > a.timestamp ? b : a;
}

/** A relative time as a count and a unit, such as 3 and `day`. */
export type Ago = { count: number; unit: AgoUnit };

/** The units a relative time is written in. */
export type AgoUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'now';

const UNITS: readonly [AgoUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60],
];

/**
 * @description Works out how long ago a time was, in the largest whole unit.
 * @param timestamp The time, in milliseconds.
 * @param now The current time, in milliseconds.
 * @returns The count and unit; under a minute is `now`.
 */
export function timeAgo(timestamp: number, now: number): Ago {
	const seconds = Math.max(0, Math.round((now - timestamp) / 1000));

	for (const [unit, size] of UNITS) {
		if (seconds >= size) return { count: Math.floor(seconds / size), unit };
	}

	return { count: 0, unit: 'now' };
}
