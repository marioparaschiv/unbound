import type { FluxChannel } from '@unbound-app/api/flux';

import type { ChannelAccess } from '~/embeds';
import { ChannelStore, Constants, PermissionStore, UserStore } from '~/modules';

type Channel = FluxChannel & {
	isPrivate?: () => boolean;
};

function can(permission: bigint | undefined, channel: Channel): boolean {
	return permission !== undefined && PermissionStore.can(permission, channel);
}

/**
 * @description Reads what the viewer may do in a channel from Discord's user, channel and permission stores.
 * @param channelId The message's channel.
 * @returns The viewer's access, or `null` when the channel is not loaded.
 */
export function getChannelAccess(channelId: string): ChannelAccess | null {
	const channel: Channel | undefined = ChannelStore.getChannel(channelId);

	if (!channel) return null;

	const permissions = Constants.Permissions as Record<string, bigint> | undefined;

	return {
		currentUserId: UserStore.getCurrentUser?.()?.id,
		isPrivate: !!channel.isPrivate?.(),
		canEmbedLinks: can(permissions?.EMBED_LINKS, channel),
		canManageMessages: can(permissions?.MANAGE_MESSAGES, channel),
	};
}

export default getChannelAccess;
