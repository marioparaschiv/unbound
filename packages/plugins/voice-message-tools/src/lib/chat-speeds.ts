/** Each conversation's remembered speed, by channel id, as the speed setting stores speeds. */
export type ChatSpeeds = Record<string, string>;

/**
 * @description Picks the speed for a conversation: its remembered one, or the default.
 * @param speeds The remembered speeds.
 * @param channelId The conversation, if one is open.
 * @param fallback The default speed setting.
 * @returns The stored speed to use.
 */
export function speedForChat(
	speeds: ChatSpeeds,
	channelId: string | undefined,
	fallback: string,
): string {
	return (channelId && speeds[channelId]) || fallback;
}

/**
 * @description Remembers a speed for a conversation, forgetting it when it matches the default.
 * @param speeds The remembered speeds.
 * @param channelId The conversation.
 * @param speed The stored speed.
 * @param fallback The default speed setting.
 * @returns The new remembered speeds.
 */
export function rememberSpeed(
	speeds: ChatSpeeds,
	channelId: string,
	speed: string,
	fallback: string,
): ChatSpeeds {
	const { [channelId]: _previous, ...rest } = speeds;

	return speed === fallback ? rest : { ...rest, [channelId]: speed };
}
