export type GuildReadState = {
	hasUnread(guildId: string): boolean;
	getGuildHasUnreadIgnoreMuted(guildId: string): boolean;
	getMentionCount(guildId: string): number;
};

/**
 * @description Picks the servers with anything unread, muted or not, or a mention.
 * @param guildIds Every server, in the order the server list shows them.
 * @param state Discord's `GuildReadStateStore`.
 * @returns The servers to mark as read.
 */
export function unreadGuilds(guildIds: readonly string[], state: GuildReadState): string[] {
	return guildIds.filter(
		(id) =>
			state.hasUnread(id) ||
			state.getGuildHasUnreadIgnoreMuted(id) ||
			state.getMentionCount(id) > 0,
	);
}

export default unreadGuilds;
