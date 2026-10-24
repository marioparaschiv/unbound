type TypingFilter = {
	currentUserId: string | undefined;
	includeBlocked: boolean;
	includeIgnored: boolean;
	isBlocked: (id: string) => boolean;
	isIgnored: (id: string) => boolean;
};

/**
 * @description Picks the typing users to show, leaving out the current user and, unless included, blocked and ignored users.
 * @param typingUsers The typing store's snapshot for a channel, keyed by user ID.
 * @param filter Who to leave out.
 * @returns The IDs of the typing users to show, in snapshot order.
 */
export function visibleTypingIds(
	typingUsers: Record<string, number> | null | undefined,
	filter: TypingFilter,
): string[] {
	return Object.keys(typingUsers ?? {}).filter(
		(id) =>
			id !== filter.currentUserId &&
			(filter.includeBlocked || !filter.isBlocked(id)) &&
			(filter.includeIgnored || !filter.isIgnored(id)),
	);
}

/**
 * @description Compares two ID lists in order, so an unchanged snapshot does not re-render the indicator.
 * @param first The previous IDs.
 * @param second The next IDs.
 * @returns Whether both lists hold the same IDs in the same order.
 */
export function sameIds(first: string[], second: string[]): boolean {
	return first.length === second.length && first.every((id, index) => id === second[index]);
}

export default { visibleTypingIds, sameIds };
