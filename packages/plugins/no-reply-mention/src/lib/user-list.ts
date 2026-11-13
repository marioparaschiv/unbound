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
 * @description Writes user IDs in the stored exception list's format.
 * @param userIds The IDs, in order.
 * @returns The setting value, one unique ID per line.
 */
export function formatUserList(userIds: string[]): string {
	return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))].join('\n');
}

export default { parseUserList, shouldMention, formatUserList };
