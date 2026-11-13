import { parseIdList } from '@unbound-plugins/shared/entities/id-list';

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
	return pingListed && authorId !== undefined && parseIdList(userList).includes(authorId);
}

export default shouldMention;
