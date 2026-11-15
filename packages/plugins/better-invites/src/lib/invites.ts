const INVITE = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]+)/gi;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Expiry =
	| { kind: 'never' }
	| { kind: 'expired' }
	| { kind: 'minutes' | 'hours' | 'days'; count: number };

/**
 * @description Lists the invite codes in a message, in the order Discord shows their embeds.
 * @param content The message's text.
 * @returns The codes, each once.
 */
export function inviteCodes(content: string): string[] {
	return [...new Set([...content.matchAll(INVITE)].map((match) => match[1]!))];
}

/**
 * @description Works out how long an invite has left, in the largest whole unit.
 * @param expiresAt When it expires, as an ISO date, or `null` for one that never does.
 * @param now The current time.
 * @returns The time left.
 */
export function expiryOf(expiresAt: string | null | undefined, now = Date.now()): Expiry {
	if (!expiresAt) return { kind: 'never' };

	const left = Date.parse(expiresAt) - now;

	if (Number.isNaN(left)) return { kind: 'never' };
	if (left <= 0) return { kind: 'expired' };
	if (left >= DAY) return { kind: 'days', count: Math.floor(left / DAY) };
	if (left >= HOUR) return { kind: 'hours', count: Math.floor(left / HOUR) };

	return { kind: 'minutes', count: Math.max(1, Math.floor(left / MINUTE)) };
}
