import type { RoleColorStops } from '@unbound-plugins/shared/colors/role-colors';

import { DiscordConstants, PermissionUtils, settings } from '~/modules';
import { TAGS } from '~/constants';

type PermissionName =
	| 'ADMINISTRATOR'
	| 'MANAGE_GUILD'
	| 'MANAGE_CHANNELS'
	| 'MANAGE_ROLES'
	| 'MANAGE_WEBHOOKS'
	| 'MANAGE_MESSAGES'
	| 'KICK_MEMBERS'
	| 'BAN_MEMBERS'
	| 'MOVE_MEMBERS'
	| 'MUTE_MEMBERS'
	| 'DEAFEN_MEMBERS';

export type User = { id: string; bot?: boolean };
export type Guild = { id: string; ownerId: string };
export type Channel = { guild_id?: string; permissionOverwrites?: object };
export type Message = {
	author?: User;
	channel_id: string;
	webhookId?: string;
	colorString?: string;
	colorStrings?: RoleColorStops;
};

type TagMatch =
	| { condition: (message: Message, user: User, guild: Guild | undefined) => boolean }
	| { permissions: PermissionName[] };

export type Tag = {
	name: string;
	displayName: string;
	description: string;
	color: string;
} & TagMatch;

function hasPermission(
	user: User,
	guild: Guild | undefined,
	channel: Channel | undefined,
	names: PermissionName[],
): boolean {
	if (!guild) return false;

	let total: bigint;

	try {
		total = PermissionUtils.computePermissions({
			user,
			context: guild,
			overwrites: channel?.permissionOverwrites,
		});
	} catch {
		return false;
	}

	return names.some((name) => {
		const bit = DiscordConstants.Permissions[name];

		return typeof bit === 'bigint' && (total & bit) === bit;
	});
}

/**
 * @description Finds the first enabled tag the message author qualifies for.
 * @param message The message the tag is shown on.
 * @param user The message author.
 * @param guild The guild the message was sent in, if any.
 * @param channel The channel the message was sent in.
 * @returns The tag to show, or `undefined` when none applies.
 */
export function resolveTag(
	message: Message,
	user: User,
	guild: Guild | undefined,
	channel: Channel | undefined,
): Tag | undefined {
	return TAGS.find((tag) => {
		if (!settings.get(`tag.${tag.name}`, true)) return false;

		if ('condition' in tag) return tag.condition(message, user, guild);

		return !user.bot && hasPermission(user, guild, channel, tag.permissions);
	});
}

export default { resolveTag };
