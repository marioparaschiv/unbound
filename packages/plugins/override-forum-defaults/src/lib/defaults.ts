import type { SettingsEntry } from '@unbound-app/settings';

import { FORUM_LAYOUTS, THREAD_SORT_ORDERS } from '~/lib/constants';

export type ForumChannel = {
	isMediaChannel?: () => boolean;
	isGameInvitesChannel?: () => boolean;
};

function isMediaChannel(channel: ForumChannel | undefined): boolean {
	return channel?.isMediaChannel?.() === true;
}

function isGameInvitesChannel(channel: ForumChannel | undefined): boolean {
	return channel?.isGameInvitesChannel?.() === true;
}

/**
 * @description Picks a forum channel's default layout: the chosen one, except in media and game invite channels, which keep Discord's fixed gallery.
 * @param channel The channel record.
 * @param choice The layout the user picked.
 * @param discordDefault Reads Discord's own default for the channel.
 * @returns Discord's `ForumLayout` value.
 */
export function defaultLayout(
	channel: ForumChannel | undefined,
	choice: SettingsEntry<'defaultLayout'>,
	discordDefault: () => unknown,
): unknown {
	if (isMediaChannel(channel) || isGameInvitesChannel(channel)) return discordDefault();

	return FORUM_LAYOUTS[choice];
}

/**
 * @description Picks a forum channel's default sort order: the chosen one, except in game invite channels, which keep Discord's fixed order.
 * @param channel The channel record.
 * @param choice The sort order the user picked.
 * @param discordDefault Reads Discord's own default for the channel.
 * @returns Discord's `ThreadSortOrder` value.
 */
export function defaultSortOrder(
	channel: ForumChannel | undefined,
	choice: SettingsEntry<'defaultSortOrder'>,
	discordDefault: () => unknown,
): unknown {
	if (isGameInvitesChannel(channel)) return discordDefault();

	return THREAD_SORT_ORDERS[choice];
}
