/** One user's voice state in a `VOICE_STATE_UPDATES` action. */
export type VoiceStateUpdate = { userId?: string; channelId?: string | null };

/**
 * @description Finds the chosen users who just joined your voice channel: their new channel is yours and their old one was not.
 * @param updates The action's voice states.
 * @param myChannel Your voice channel, if you are in one.
 * @param previousChannel Each user's channel before the update.
 * @param chosen The chosen user ids.
 * @param myId Your own user id, which never counts.
 * @returns The ids that joined.
 */
export function joinedUsers(
	updates: VoiceStateUpdate[],
	myChannel: string | undefined,
	previousChannel: (userId: string) => string | null | undefined,
	chosen: ReadonlySet<string>,
	myId: string | undefined,
): string[] {
	if (!myChannel) return [];

	return updates
		.filter(
			({ userId, channelId }) =>
				userId && userId !== myId && chosen.has(userId) && channelId === myChannel,
		)
		.filter(({ userId }) => previousChannel(userId!) !== myChannel)
		.map(({ userId }) => userId!);
}
