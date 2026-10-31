import { flux, storage } from '@unbound-app/api';
import { useRef } from 'react';

import { sameIds, visibleTypingIds } from '~/typing-users';
import type { Channel } from '~/types';
import {
	RelationshipStore,
	SelectedChannelStore,
	TypingStore,
	UserGuildSettingsStore,
	UserStore,
} from '~/modules';

/**
 * @description Tracks who is typing in a channel, filtered by the plugin's settings.
 * @param channel The channel the row shows.
 * @param muted Whether the row shows the channel as muted.
 * @returns The IDs of the typing users to show.
 */
function useTypingIds(channel: Channel, muted: boolean): string[] {
	const store = storage.useBucket(addon.id);
	const previousIds = useRef<string[]>([]);
	const includeCurrent = store.get('includeCurrentChannel', true);
	const includeMuted = store.get('includeMutedChannels', false);
	const includeBlocked = store.get('includeBlockedUsers', false);
	const includeIgnored = store.get('includeIgnoredUsers', false);

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

	function readKeepingPreviousWhenSame(): string[] {
		const next = visible();

		if (!sameIds(previousIds.current, next)) {
			previousIds.current = next;
		}

		return previousIds.current;
	}

	const stores = [
		TypingStore,
		RelationshipStore,
		UserGuildSettingsStore,
		SelectedChannelStore,
	].filter((store) => Reflect.get(store, 'module'));

	return flux.useStore(stores, readKeepingPreviousWhenSame, [
		channel.id,
		channel.guild_id,
		muted,
		includeCurrent,
		includeMuted,
		includeBlocked,
		includeIgnored,
	]);
}

export default useTypingIds;
