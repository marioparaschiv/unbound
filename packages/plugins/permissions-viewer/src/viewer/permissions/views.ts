import { messages } from '@unbound-app/i18n';

import {
	channelEntries,
	listPermissionBits,
	memberEntries,
	memberRoles,
	roleEntries,
	sortByPosition,
	type Entry,
	type PermissionBit,
} from '~/viewer/permissions/model';
import {
	ChannelStore,
	Constants,
	GuildMemberStore,
	GuildRoleStore,
	GuildStore,
	UserStore,
} from '~/viewer/modules';
import type { Target } from '~/viewer/action-sheets/targets';
import type { Channel, Guild, GuildRole } from '~/types';

export type PermissionsView = {
	guild: Guild;
	header: string;
	entries: Entry[];
};

/**
 * @description Reads Discord's permission flags.
 * @returns Each permission once, in Discord's order.
 */
export function getPermissionBits(): PermissionBit[] {
	return listPermissionBits(Constants?.Permissions);
}

/**
 * @description Reads a server's roles from the highest down, from the role store or, on older builds, the server record.
 * @param guild The server.
 * @returns The roles, `@everyone` included.
 */
export function getSortedRoles(guild: Guild): GuildRole[] {
	const sorted = GuildRoleStore.getSortedRoles?.(guild.id);

	if (Array.isArray(sorted)) return sorted;

	const snapshot = GuildRoleStore.getRolesSnapshot?.(guild.id) ?? guild.roles ?? {};

	return sortByPosition(Object.values(snapshot));
}

/**
 * @description Reads one role of a server.
 * @param guild The server.
 * @param roleId The role's ID.
 * @returns The role, or `undefined` when it is gone.
 */
export function getRole(guild: Guild, roleId: string): GuildRole | undefined {
	return (
		GuildRoleStore.getRole?.(guild.id, roleId) ??
		GuildRoleStore.getRolesSnapshot?.(guild.id)?.[roleId] ??
		guild.roles?.[roleId] ??
		undefined
	);
}

function memberName(guildId: string, userId: string): string {
	const nick = GuildMemberStore.getMember(guildId, userId)?.nick;

	return nick || UserStore.getUser(userId)?.username || messages.UNKNOWN_USER;
}

/**
 * @description Builds the member list a server member's permissions come from: their roles, and ownership.
 * @param guild The server.
 * @param userId The member's user ID.
 * @returns The view, or `null` when the user is not a member.
 */
export function memberView(guild: Guild, userId: string): PermissionsView | null {
	const member = GuildMemberStore.getMember(guild.id, userId);

	if (!member) return null;

	const roles = memberRoles(getSortedRoles(guild), guild.id, member);

	return {
		guild,
		header: memberName(guild.id, userId),
		entries: memberEntries(roles, guild.ownerId === userId, getPermissionBits()),
	};
}

/**
 * @description Builds the overwrite list of a server channel.
 * @param guild The channel's server.
 * @param channel The channel.
 * @returns The view.
 */
export function channelView(guild: Guild, channel: Channel): PermissionsView {
	return {
		guild,
		header: channel.name,
		entries: channelEntries(
			channel.permissionOverwrites,
			(roleId) => getRole(guild, roleId)?.position,
		),
	};
}

/**
 * @description Builds the role list of a server.
 * @param guild The server.
 * @returns The view.
 */
export function guildView(guild: Guild): PermissionsView {
	return { guild, header: guild.name, entries: roleEntries(getSortedRoles(guild)) };
}

/**
 * @description Builds the view a sheet or menu target opens.
 * @param target A member, channel or server.
 * @returns The view, or `null` when the target is not in a server the client knows.
 */
export function viewForTarget(target: Target): PermissionsView | null {
	if (target.kind === 'channel') {
		const channel = ChannelStore.getChannel(target.channelId) as Channel | undefined;
		const guild = channel?.guild_id
			? (GuildStore.getGuild(channel.guild_id) as Guild | undefined)
			: undefined;

		return channel && guild ? channelView(guild, channel) : null;
	}

	const guild = GuildStore.getGuild(target.guildId) as Guild | undefined;

	if (!guild) return null;

	return target.kind === 'member' ? memberView(guild, target.userId) : guildView(guild);
}

/**
 * @description Decides whether a target has permissions to show, so rows appear only where they open something: a server member, a server channel or a server.
 * @param target A member, channel or server.
 * @returns `true` when the target is in a server the client knows.
 */
export function hasPermissionsView(target: Target): boolean {
	if (target.kind === 'member') {
		return Boolean(
			GuildStore.getGuild(target.guildId) &&
			GuildMemberStore.getMember(target.guildId, target.userId),
		);
	}

	if (target.kind === 'guild') return Boolean(GuildStore.getGuild(target.guildId));

	const guildId = ChannelStore.getChannel(target.channelId)?.guild_id;

	return Boolean(guildId && GuildStore.getGuild(guildId));
}
