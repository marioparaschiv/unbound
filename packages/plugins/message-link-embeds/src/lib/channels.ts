import {
	ChannelStore,
	GuildStore,
	RelationshipStore,
	UserStore,
	type Message,
} from '~/lib/modules';
import type { LinkTarget } from '~/lib/link-targets';

/**
 * @description Lists the names Discord may label a message link's chip with: older builds use the channel's name, Discord 355 the server's, or a DM's recipient.
 * @param target The linked message.
 * @param message The linked message's data, used when the channel is not in the store.
 * @returns The distinct non-empty names, or `undefined` when none is known.
 */
export function linkChipNames(target: LinkTarget, message: Message): string[] | undefined {
	const channel = ChannelStore.getChannel(target.channelId);
	const names = [channel?.name, message.channelName, message.channel_name];

	if (channel?.guild_id) names.push(GuildStore.getGuild(channel.guild_id)?.name);

	for (const id of channel?.recipients ?? []) {
		const user = UserStore.getUser(id);

		names.push(RelationshipStore.getNickname(id), user?.globalName, user?.username);
	}

	const known = names.filter(
		(name): name is string => typeof name === 'string' && name.length > 0,
	);

	return known.length ? [...new Set(known)] : undefined;
}
