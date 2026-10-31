import { ChannelStore } from '~/modules';

/**
 * @description Finds the guild a channel belongs to.
 * @param channelId The channel, if known.
 * @returns The guild ID, or `undefined` for a DM, an unknown channel, or no channel.
 */
export function guildIdOf(channelId: string | undefined): string | undefined {
	return channelId ? ChannelStore.getChannel(channelId)?.guild_id : undefined;
}

export default guildIdOf;
