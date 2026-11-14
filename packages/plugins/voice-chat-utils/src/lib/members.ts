import { flux, metro } from '@unbound-app/api';

import type { VoiceState } from '~/lib/actions';

type Channel = { id: string; guild_id?: string; name?: string; type?: number };

type GuildChannels = { VOCAL?: { channel: Channel }[] };

/**
 * @description Reads the channel a long-press sheet is about.
 * @param channelId The channel.
 * @returns The channel, or `undefined` when Discord does not know it.
 */
export function channelOf(channelId: string): Channel | undefined {
	return (
		flux.getStore('Channel') as unknown as { getChannel(id: string): Channel | undefined }
	).getChannel(channelId);
}

/**
 * @description Reads who is in a voice channel.
 * @param channelId The channel.
 * @returns Their voice states, by user id.
 */
export function voiceStatesOf(channelId: string): Record<string, VoiceState | undefined> {
	return metro.findByProps('getVoiceStatesForChannel')?.getVoiceStatesForChannel(channelId) ?? {};
}

/**
 * @description Lists a server's other voice channels to move people into.
 * @param guildId The server.
 * @param exceptId The channel people are moved out of.
 * @returns The channels, in the server's order.
 */
export function otherVoiceChannels(guildId: string, exceptId: string): Channel[] {
	const channels = metro.findByProps('getChannels', 'getDefaultChannel')?.getChannels(guildId) as
		| GuildChannels
		| undefined;

	return (channels?.VOCAL ?? [])
		.map(({ channel }) => channel)
		.filter((channel) => channel.id !== exceptId);
}

/**
 * @description Tells whether you hold a permission in a channel.
 * @param permission The permission's name, such as `MOVE_MEMBERS`.
 * @param channel The channel.
 * @returns Whether you hold it there.
 */
export function canIn(permission: string, channel: Channel): boolean {
	const bits = (metro.common.Constants.Permissions as Record<string, bigint | undefined>)[
		permission
	];
	const store = flux.getStore('Permission') as unknown as {
		can(bits: bigint, channel: Channel): boolean;
	};

	return bits !== undefined && store.can(bits, channel);
}

/**
 * @description Edits one member of a server, such as moving or muting them.
 * @param guildId The server.
 * @param userId The member.
 * @param body The edit.
 * @returns The request.
 */
export function editMember(
	guildId: string,
	userId: string,
	body: Record<string, boolean | string | null>,
): Promise<unknown> {
	return metro.common.REST.patch({ url: `/guilds/${guildId}/members/${userId}`, body });
}
