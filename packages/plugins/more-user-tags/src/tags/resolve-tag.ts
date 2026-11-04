import { settings } from '@unbound-app/settings';

import type { Channel, Guild, Message, PermissionName, Tag, User } from '~/types';
import { DiscordConstants, PermissionUtils } from '~/tags/modules';
import { TAGS } from '~/constants';

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
		if (!settings.tag[tag.name]) return false;

		if ('condition' in tag) return tag.condition(message, user, guild);

		return !user.bot && hasPermission(user, guild, channel, tag.permissions);
	});
}

export default { resolveTag };
