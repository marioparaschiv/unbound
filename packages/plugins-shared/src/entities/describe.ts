import type { FluxChannel, FluxGuild, FluxStore, FluxUser } from '@unbound-app/api/flux';
import { flux, metro } from '@unbound-app/api';

import type { Entity, EntityKind } from './entity';

type IconUtils = {
	getUserAvatarURL(user: FluxUser, canAnimate?: boolean, size?: number): string;
	getGuildIconURL(guild: { id: string; icon: string | null; size?: number }): string | undefined;
};

type GuildChannels = FluxStore & {
	getMutableGuildChannelsForGuild(guildId: string): Record<string, FluxChannel>;
};

type ChannelWithParent = FluxChannel & { parent_id?: string | null };

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		SortedGuild: FluxStore & { getFlattenedGuildIds(): string[] };
	}
}

const AVATAR_SIZE = 64;

// The icon each channel type shows in Discord's channel list.
const CHANNEL_ICONS: Partial<Record<number, string>> = {
	0: 'TextIcon',
	2: 'VoiceNormalIcon',
	4: 'FolderIcon',
	5: 'AnnouncementsIcon',
	13: 'VoiceNormalIcon',
	15: 'ForumIcon',
	16: 'ForumIcon',
};

export const Users = flux.getStore('User');
export const Guilds = flux.getStore('Guild');
export const Channels = flux.getStore('Channel');
export const SortedGuilds = flux.getStore('SortedGuild');
export const Relationships = flux.getStore('Relationship');
// The same store as `Channels`, read through a method the SDK does not type.
export const GuildChannels = flux.getStore('Channel') as unknown as GuildChannels;

const Icons = metro.findByProps('getUserAvatarURL', 'getGuildIconURL') as IconUtils | undefined;

/**
 * @description Draws a user as a row: their friend nickname or global name, then `@username`, with their avatar.
 * @param user The user.
 * @returns The entity.
 */
export function describeUser(user: FluxUser): Entity {
	return {
		kind: 'user',
		id: user.id,
		name: Relationships.getNickname(user.id) || user.globalName || user.username,
		detail: `@${user.username}`,
		image: Icons?.getUserAvatarURL(user, false, AVATAR_SIZE),
	};
}

/**
 * @description Draws a server as a row, with its icon.
 * @param guild The server.
 * @returns The entity.
 */
export function describeGuild(guild: FluxGuild): Entity {
	const image = guild.icon ? Icons?.getGuildIconURL({ ...guild, size: AVATAR_SIZE }) : undefined;

	return { kind: 'guild', id: guild.id, name: guild.name, image, icon: 'ServerIcon' };
}

/**
 * @description Draws a channel as a row: `#name` for a text channel, then its server and category.
 * @param channel The channel.
 * @returns The entity.
 */
export function describeChannel(channel: ChannelWithParent): Entity {
	const guild = channel.guild_id ? Guilds.getGuild(channel.guild_id) : undefined;
	const parent = channel.parent_id ? Channels.getChannel(channel.parent_id) : undefined;

	return {
		kind: 'channel',
		id: channel.id,
		name: channel.type === 0 || channel.type === 5 ? `#${channel.name}` : channel.name,
		detail: [guild?.name, parent?.name].filter(Boolean).join(' · ') || undefined,
		icon: CHANNEL_ICONS[channel.type] ?? 'TextIcon',
	};
}

/**
 * @description Reads what Discord's stores hold for an id.
 * @param kind What the id names.
 * @param id The id.
 * @returns The entity, or `undefined` when the stores do not hold it.
 */
export function describeEntity(kind: EntityKind, id: string): Entity | undefined {
	switch (kind) {
		case 'user': {
			const user = Users.getUser(id);

			return user ? describeUser(user) : undefined;
		}
		case 'guild': {
			const guild = Guilds.getGuild(id);

			return guild ? describeGuild(guild) : undefined;
		}
		case 'channel': {
			const channel = Channels.getChannel(id);

			return channel ? describeChannel(channel) : undefined;
		}
	}
}

export default { describeChannel, describeEntity, describeGuild, describeUser };
