const DISCORD_EPOCH = 1_420_070_400_000n;
const DAY_MS = 86_400_000;

/**
 * @description Reads how many whole days ago a message was sent, from its snowflake id.
 * @param messageId The message's id.
 * @param now The current time in milliseconds.
 * @returns The age in days, or `undefined` when the id is not a snowflake.
 */
export function messageAgeDays(messageId: string, now: number): number | undefined {
	if (!/^\d{17,20}$/.test(messageId)) return undefined;

	const sentAt = Number((BigInt(messageId) >> 22n) + DISCORD_EPOCH);

	return Math.floor((now - sentAt) / DAY_MS);
}
