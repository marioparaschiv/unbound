import type { FilterContext } from '~/log/filters';
import { ChannelStore, UserStore } from '~/discord/modules';

/**
 * @description Looks up the current user and a channel for the ignore rules.
 * @param channelId The channel a message is in.
 * @returns The filter context.
 */
export function filterContext(channelId: string | undefined): FilterContext {
	return {
		currentUserId: UserStore.getCurrentUser?.()?.id,
		channel: channelId ? ChannelStore.getChannel(channelId) : undefined,
	};
}

export default filterContext;
