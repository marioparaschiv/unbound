/** Who is followed and the voice channel they were last seen in. */
export type Followed = { userId: string; name: string; channelId: string | null };

/** A voice state as `VOICE_STATE_UPDATES` carries it. */
export type VoiceUpdate = { userId?: string; channelId?: string | null };

/** What following asks for after a voice update: join a channel, leave voice, or nothing. */
export type FollowStep = { join: string } | { leave: true } | undefined;

/**
 * @description Decides what to do when voice states change while following someone.
 * @param followed Who is followed.
 * @param updates The changed voice states.
 * @param options Whether you must already be in voice, whether you are, and whether to leave with them.
 * @returns The step to take.
 */
export function followStep(
	followed: Followed,
	updates: readonly VoiceUpdate[],
	options: { onlyWhenInVoice: boolean; inVoice: boolean; leaveWithThem: boolean },
): FollowStep {
	const update = updates.findLast((state) => state.userId === followed.userId);

	if (!update || (options.onlyWhenInVoice && !options.inVoice)) return undefined;

	if (update.channelId && update.channelId !== followed.channelId)
		return { join: update.channelId };

	if (!update.channelId && options.leaveWithThem && options.inVoice) return { leave: true };

	return undefined;
}

export default followStep;
