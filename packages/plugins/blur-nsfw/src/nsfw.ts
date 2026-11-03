export type ChannelLike = {
	nsfw?: unknown;
	parent_id?: unknown;
};

export type ChannelLookup = (id: string) => ChannelLike | undefined | null;

function isMarkedNsfw(channel: ChannelLike | undefined | null): boolean {
	return channel?.nsfw === true;
}

/**
 * @description Tells whether a channel is age-restricted, counting a thread as age-restricted when its parent channel is.
 * @param channelId The channel's id.
 * @param getChannel Looks up a channel by id.
 * @returns `true` when the channel or its parent is marked NSFW.
 */
export function isNsfwChannel(channelId: unknown, getChannel: ChannelLookup): boolean {
	if (typeof channelId !== 'string' || !channelId) return false;

	const channel = getChannel(channelId);

	if (isMarkedNsfw(channel)) return true;

	const parentId = channel?.parent_id;

	return typeof parentId === 'string' && parentId !== '' && isMarkedNsfw(getChannel(parentId));
}
