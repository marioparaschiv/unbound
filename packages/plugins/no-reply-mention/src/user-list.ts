/**
 * @description Reads the stored exception list, which separates IDs with commas, spaces or newlines.
 * @param value The stored `userList` setting.
 * @returns The unique user IDs, in stored order, or none when the setting is not a string.
 */
export function parseUserList(
	// UNKNOWN: the store returns whatever was saved under `userList`, which may not be a string.
	value: unknown,
): string[] {
	if (typeof value !== 'string') return [];

	return [...new Set(value.split(/[\s,]+/).filter(Boolean))];
}

/**
 * @description Decides whether a new reply mentions the author of the message it replies to.
 * @param authorId The replied-to message's author.
 * @param userList The stored `userList` setting.
 * @param pingListed The stored `shouldPingListed` setting.
 * @returns `true` only when listed users may be pinged and the author is on the list.
 */
export function shouldMention(
	authorId: string | undefined,
	userList: string,
	pingListed: boolean,
): boolean {
	return pingListed && authorId !== undefined && parseUserList(userList).includes(authorId);
}

/**
 * @description Checks that a value looks like a Discord user ID.
 * @param value The text the user entered.
 * @returns Whether the value is a 15 to 25 digit snowflake.
 */
export function isUserId(value: string): boolean {
	return /^\d{15,25}$/.test(value.trim());
}

function serializeUserList(userIds: string[]): string {
	return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))].join('\n');
}

/**
 * @description Adds a user ID to the stored exception list.
 * @param value The stored `userList` setting.
 * @param userId The ID to add.
 * @returns The new setting value, one ID per line, without duplicates.
 */
export function addUserId(value: string, userId: string): string {
	return serializeUserList([...parseUserList(value), userId]);
}

/**
 * @description Replaces a user ID in the stored exception list.
 * @param value The stored `userList` setting.
 * @param currentUserId The ID to replace.
 * @param nextUserId The ID to put in its place.
 * @returns The new setting value, one ID per line, without duplicates.
 */
export function editUserId(value: string, currentUserId: string, nextUserId: string): string {
	return serializeUserList(
		parseUserList(value).map((id) => (id === currentUserId ? nextUserId : id)),
	);
}

/**
 * @description Removes a user ID from the stored exception list.
 * @param value The stored `userList` setting.
 * @param userId The ID to remove.
 * @returns The new setting value, one ID per line.
 */
export function removeUserId(value: string, userId: string): string {
	return serializeUserList(parseUserList(value).filter((id) => id !== userId));
}

export default {
	parseUserList,
	shouldMention,
	isUserId,
	addUserId,
	editUserId,
	removeUserId,
};
