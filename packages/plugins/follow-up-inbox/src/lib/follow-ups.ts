export type FollowUp = {
	channelId: string;
	messageId: string;
	guildId: string | null;
	author: string;
	snippet: string;
	addedAt: number;
};

const SNIPPET_LENGTH = 120;

function isFollowUp(value: unknown): value is FollowUp {
	const entry = value as Partial<FollowUp> | null;

	return (
		typeof entry?.channelId === 'string' &&
		typeof entry.messageId === 'string' &&
		typeof entry.author === 'string' &&
		typeof entry.snippet === 'string' &&
		typeof entry.addedAt === 'number'
	);
}

/**
 * @description Reads saved follow-ups, dropping anything malformed.
 * @param value What storage held.
 * @returns The follow-ups, newest first.
 */
export function parseFollowUps(value: unknown): FollowUp[] {
	return Array.isArray(value)
		? value.filter(isFollowUp).sort((a, b) => b.addedAt - a.addedAt)
		: [];
}

/**
 * @description Shortens a message's text to one line for the list.
 * @param content The message text.
 * @returns At most 120 characters on one line.
 */
export function snippetOf(content: string): string {
	const line = content.replace(/\s+/g, ' ').trim();

	return line.length > SNIPPET_LENGTH ? `${line.slice(0, SNIPPET_LENGTH - 1)}…` : line;
}

/**
 * @description Whether a message is waiting for a follow-up.
 * @param list The follow-ups.
 * @param messageId The message.
 * @returns `true` when it is in the list.
 */
export function isFollowedUp(list: FollowUp[], messageId: string): boolean {
	return list.some((entry) => entry.messageId === messageId);
}

/**
 * @description Adds a follow-up, replacing an older entry for the same message.
 * @param list The follow-ups.
 * @param entry The new follow-up.
 * @returns The new list, newest first.
 */
export function addFollowUp(list: FollowUp[], entry: FollowUp): FollowUp[] {
	return [entry, ...list.filter((item) => item.messageId !== entry.messageId)];
}

/**
 * @description Removes a message's follow-up.
 * @param list The follow-ups.
 * @param messageId The message that no longer needs an answer.
 * @returns The list without it.
 */
export function removeFollowUp(list: FollowUp[], messageId: string): FollowUp[] {
	return list.filter((item) => item.messageId !== messageId);
}

export default { parseFollowUps, snippetOf, isFollowedUp, addFollowUp, removeFollowUp };
