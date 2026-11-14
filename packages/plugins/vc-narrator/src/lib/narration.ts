export type VoiceStateUpdate = {
	userId: string;
	channelId?: string | null;
	oldChannelId?: string | null;
};

export type VoiceEvent = 'join' | 'leave' | 'move';

export type Narration = { event: VoiceEvent; self: boolean; channelId: string };

/**
 * @description Works out what a voice state update means for the listener: someone joining, leaving or moving through their channel, or the listener themself joining, leaving or switching.
 * @param update The voice state update.
 * @param me The listener's user id and the voice channel they are in.
 * @returns The event to announce, with the channel it names, or `undefined` when it does not concern the listener.
 */
export function narrationFor(
	{ userId, channelId, oldChannelId }: VoiceStateUpdate,
	me: { id: string; channelId?: string | null },
): Narration | undefined {
	const to = channelId ?? undefined;
	const from = oldChannelId ?? undefined;

	if (to === from) return undefined;

	const self = userId === me.id;

	if (!self && (!me.channelId || (to !== me.channelId && from !== me.channelId)))
		return undefined;

	if (to) return { event: from ? 'move' : 'join', self, channelId: to };
	if (from) return { event: 'leave', self, channelId: from };

	return undefined;
}
