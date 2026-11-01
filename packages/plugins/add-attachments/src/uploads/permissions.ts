import { ChannelStore, Constants, PermissionStore } from '~/discord/modules';

/**
 * @description Tells whether you may send and attach files in a channel. DMs and group DMs always allow it.
 * @param channelId The channel.
 * @returns `true` when attachments may be added there.
 */
export function canAttachIn(channelId: string): boolean {
	const channel = ChannelStore.getChannel(channelId);

	if (!channel) return false;

	if ((channel as { isPrivate?: () => boolean }).isPrivate?.()) return true;

	const permissions = Constants.Permissions as Record<string, bigint> | undefined;

	if (!permissions?.SEND_MESSAGES || !permissions.ATTACH_FILES) return false;

	return (
		PermissionStore.can(permissions.SEND_MESSAGES, channel) &&
		PermissionStore.can(permissions.ATTACH_FILES, channel)
	);
}

export default canAttachIn;
