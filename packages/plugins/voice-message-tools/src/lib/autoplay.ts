const VOICE_MESSAGE_FLAG = 1 << 13;
const END_SLACK_SECS = 0.35;

export type ChatMessage = { id: string; flags?: number };

export type PlaybackEnded = {
	messageId?: string;
	isVoiceMessage?: boolean;
	endDurationSecs?: number;
	totalDurationSecs?: number;
};

/**
 * @description Tells a voice message that played to its end from one paused or skipped.
 * @param event Discord's playback-ended event.
 * @returns Whether it finished.
 */
export function playedToEnd(event: PlaybackEnded): boolean {
	const { isVoiceMessage, endDurationSecs = 0, totalDurationSecs = 0 } = event;

	return (
		Boolean(isVoiceMessage) &&
		totalDurationSecs > 0 &&
		endDurationSecs >= totalDurationSecs - END_SLACK_SECS
	);
}

/**
 * @description Finds the voice message after one in a channel, skipping messages in between that are not voice messages.
 * @param messages The channel's loaded messages, oldest first.
 * @param messageId The voice message that finished.
 * @returns The next voice message's id, or `undefined` when it was the last.
 */
export function nextVoiceMessage(messages: ChatMessage[], messageId: string): string | undefined {
	const index = messages.findIndex(({ id }) => id === messageId);

	if (index < 0) return undefined;

	return messages.slice(index + 1).find(({ flags = 0 }) => (flags & VOICE_MESSAGE_FLAG) !== 0)
		?.id;
}
