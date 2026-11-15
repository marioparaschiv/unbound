import { ChannelType, type Guild, type GuildBasedChannel, type Role } from 'discord.js';

import type { Snapshot } from '~/lib/log-changes';

const CHANNEL_TYPES: Partial<Record<ChannelType, string>> = {
	[ChannelType.GuildText]: 'Text channel',
	[ChannelType.GuildVoice]: 'Voice channel',
	[ChannelType.GuildCategory]: 'Category',
	[ChannelType.GuildAnnouncement]: 'Announcement channel',
	[ChannelType.GuildStageVoice]: 'Stage channel',
	[ChannelType.GuildForum]: 'Forum channel',
	[ChannelType.GuildMedia]: 'Media channel',
};

const flag = (value: boolean) => (value ? 'yes' : 'no');

/**
 * @description Names a channel's kind as a log title starts, e.g. `Text channel`.
 * @param channel The channel.
 * @returns The kind's name.
 */
export function channelKind(channel: GuildBasedChannel): string {
	return CHANNEL_TYPES[channel.type] ?? 'Channel';
}

/**
 * @description Takes the channel settings a log compares; position is left out, as reordering moves many channels at once.
 * @param channel The channel.
 * @returns Its settings by label.
 */
export function channelSnapshot(channel: GuildBasedChannel): Snapshot {
	return {
		Name: channel.name,
		Category: channel.parent?.name,
		Topic: 'topic' in channel ? (channel.topic ?? undefined) : undefined,
		NSFW: 'nsfw' in channel ? flag(channel.nsfw) : undefined,
		Slowmode:
			'rateLimitPerUser' in channel && channel.rateLimitPerUser
				? `${channel.rateLimitPerUser}s`
				: undefined,
	};
}

/**
 * @description Serialises a channel's permission overwrites, to tell whether they changed.
 * @param channel The channel.
 * @returns A stable key, empty for a channel without overwrites.
 */
export function overwritesKey(channel: GuildBasedChannel): string {
	if (!('permissionOverwrites' in channel)) {
		return '';
	}

	return [...channel.permissionOverwrites.cache.values()]
		.map(({ id, allow, deny }) => `${id}:${allow.bitfield}:${deny.bitfield}`)
		.sort()
		.join(',');
}

/**
 * @description Takes the role settings a log compares; position and permissions are compared apart.
 * @param role The role.
 * @returns Its settings by label.
 */
export function roleSnapshot(role: Role): Snapshot {
	return {
		Name: role.name,
		Colour: role.hexColor,
		Hoisted: flag(role.hoist),
		Mentionable: flag(role.mentionable),
		Icon: role.iconURL() ?? role.unicodeEmoji ?? undefined,
	};
}

/**
 * @description Takes the server settings a log compares.
 * @param guild The server.
 * @returns Its settings by label.
 */
export function guildSnapshot(guild: Guild): Snapshot {
	return {
		Name: guild.name,
		Icon: guild.iconURL({ size: 1024 }) ?? undefined,
		Banner: guild.bannerURL({ size: 1024 }) ?? undefined,
		Description: guild.description ?? undefined,
		'Vanity URL': guild.vanityURLCode ?? undefined,
	};
}

export default { channelKind, channelSnapshot, overwritesKey, roleSnapshot, guildSnapshot };
