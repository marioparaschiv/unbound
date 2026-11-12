import { useSetting } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { sameIds, visibleTypingIds } from '~/lib/typing-users';
import type { Channel } from '~/lib/types';
import {
	RelationshipStore,
	SelectedChannelStore,
	TypingStore,
	UserGuildSettingsStore,
	UserStore,
} from '~/lib/modules';

/**
 * @description Tracks who is typing in a channel, filtered by the plugin's settings.
 * @param channel The channel the row shows.
 * @param muted Whether the row shows the channel as muted.
 * @returns The IDs of the typing users to show.
 */
function useTypingIds(channel: Channel, muted: boolean): string[] {
	const includeCurrent = useSetting('includeCurrentChannel');
	const includeMuted = useSetting('includeMutedChannels');
	const includeBlocked = useSetting('includeBlockedUsers');
	const includeIgnored = useSetting('includeIgnoredUsers');

	// The optional stores are called with `?.`: a missing one reads as no filter.
	function visible(): string[] {
		if (!includeCurrent && SelectedChannelStore.getChannelId?.() === channel.id) return [];

		if (
			!includeMuted &&
			(muted || UserGuildSettingsStore.isChannelMuted?.(channel.guild_id, channel.id))
		) {
			return [];
		}

		return visibleTypingIds(TypingStore.getTypingUsers(channel.id), {
			currentUserId: UserStore.getCurrentUser()?.id,
			includeBlocked,
			includeIgnored,
			isBlocked: (id) => RelationshipStore.isBlocked?.(id) ?? false,
			isIgnored: (id) => RelationshipStore.isIgnored?.(id) ?? false,
		});
	}

	const stores = [
		TypingStore,
		RelationshipStore,
		UserGuildSettingsStore,
		SelectedChannelStore,
	].filter((store) => Reflect.get(store, 'module'));

	return flux.useStore(stores, visible, {
		deps: [
			channel.id,
			channel.guild_id,
			muted,
			includeCurrent,
			includeMuted,
			includeBlocked,
			includeIgnored,
		],
		isEqual: sameIds,
	});
}

export default useTypingIds;
