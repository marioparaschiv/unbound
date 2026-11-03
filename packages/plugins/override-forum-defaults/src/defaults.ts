import {
	FORUM_LAYOUTS,
	SETTINGS,
	THREAD_SORT_ORDERS,
	type LayoutChoice,
	type SortOrderChoice,
} from '~/constants';

export type ForumChannel = {
	isMediaChannel?: () => boolean;
	isGameInvitesChannel?: () => boolean;
};

function isChoice<T extends string>(choices: Record<T, number>, value: unknown): value is T {
	return typeof value === 'string' && Object.hasOwn(choices, value);
}

function isMediaChannel(channel: ForumChannel | undefined): boolean {
	return channel?.isMediaChannel?.() === true;
}

function isGameInvitesChannel(channel: ForumChannel | undefined): boolean {
	return channel?.isGameInvitesChannel?.() === true;
}

/**
 * @description Reads a stored layout setting, falling back to the default for a missing or unknown value.
 * @param value The stored value.
 * @returns The layout choice.
 */
export function layoutChoice(value: unknown): LayoutChoice {
	return isChoice(FORUM_LAYOUTS, value) ? value : SETTINGS.defaultLayout;
}

/**
 * @description Reads a stored sort order setting, falling back to the default for a missing or unknown value.
 * @param value The stored value.
 * @returns The sort order choice.
 */
export function sortOrderChoice(value: unknown): SortOrderChoice {
	return isChoice(THREAD_SORT_ORDERS, value) ? value : SETTINGS.defaultSortOrder;
}

/**
 * @description Picks a forum channel's default layout: the chosen one, except in media and game invite channels, which keep Discord's fixed gallery.
 * @param channel The channel record.
 * @param setting The stored layout setting.
 * @param discordDefault Reads Discord's own default for the channel.
 * @returns Discord's `ForumLayout` value.
 */
export function defaultLayout(
	channel: ForumChannel | undefined,
	setting: unknown,
	discordDefault: () => unknown,
): unknown {
	if (isMediaChannel(channel) || isGameInvitesChannel(channel)) return discordDefault();

	return FORUM_LAYOUTS[layoutChoice(setting)];
}

/**
 * @description Picks a forum channel's default sort order: the chosen one, except in game invite channels, which keep Discord's fixed order.
 * @param channel The channel record.
 * @param setting The stored sort order setting.
 * @param discordDefault Reads Discord's own default for the channel.
 * @returns Discord's `ThreadSortOrder` value.
 */
export function defaultSortOrder(
	channel: ForumChannel | undefined,
	setting: unknown,
	discordDefault: () => unknown,
): unknown {
	if (isGameInvitesChannel(channel)) return discordDefault();

	return THREAD_SORT_ORDERS[sortOrderChoice(setting)];
}
