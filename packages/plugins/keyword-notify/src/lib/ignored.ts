import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings } from '@unbound-app/settings';

export type ChannelStore = {
	getChannel(id: string): { guild_id?: string | null; parent_id?: string | null } | undefined;
};

export type LocatedMessage = { channel_id?: string; author?: { id?: string } };

/**
 * @description Whether a message comes from an ignored user, or sits in an ignored channel, category or server.
 * @param Channels Discord's channel store.
 * @param message The message.
 * @param channelId Its channel, when the message itself does not say.
 * @returns `true` when keywords there never count.
 */
export function isIgnored(
	Channels: ChannelStore,
	message: LocatedMessage | undefined,
	channelId?: string,
): boolean {
	const channel = channelId ?? message?.channel_id;
	const author = message?.author?.id;

	if (author && parseIdList(settings.ignoreUsers).includes(author)) return true;
	if (!channel) return false;

	const ignoredChannels = parseIdList(settings.ignoreChannels);
	const record = Channels.getChannel(channel);

	if (ignoredChannels.includes(channel)) return true;
	if (record?.parent_id && ignoredChannels.includes(record.parent_id)) return true;

	return Boolean(
		record?.guild_id && parseIdList(settings.ignoreGuilds).includes(record.guild_id),
	);
}

export default { isIgnored };
