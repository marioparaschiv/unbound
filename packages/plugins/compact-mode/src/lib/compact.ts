/** A node of Discord's message content tree. */
export type ContentNode = { type: string; content?: unknown };

/** The parts of a chat row's message Compact Mode changes. */
export type CompactMessage = {
	authorId?: string;
	guildId?: string;
	username?: string;
	content?: ContentNode[];
	avatarURL?: string;
	timestamp?: string;
	timestampTooltip?: string;
	isFirst?: boolean;
};

const HANDLE = / \(@[^)]*\)$/;

/**
 * @description Reads the name to show from Discord's row username, which can end with the handle in brackets.
 * @param username The row's username.
 * @returns The display name.
 */
export function displayName(username: string): string {
	return username.replace(HANDLE, '');
}

/**
 * @description Turns a message row into a compact one: no avatar, header or timestamp line, and the author's name in
 * bold before the content. Discord draws a header only for rows with an avatar and timestamp.
 * @param message The row's message, changed in place.
 * @param withName Whether to put the name before this message.
 * @param name The author's name to show; Discord's follow-up rows carry only the handle.
 * @returns Whether the row changed.
 */
export function compactMessage(message: CompactMessage, withName: boolean, name?: string): boolean {
	if (!message.username || !Array.isArray(message.content)) return false;

	name ||= displayName(message.username);

	message.avatarURL = undefined;
	message.timestamp = undefined;
	message.timestampTooltip = undefined;
	message.isFirst = false;

	if (withName) {
		message.content = [
			{ type: 'strong', content: [{ type: 'text', content: name }] },
			{ type: 'text', content: '  ' },
			...message.content,
		];
	}

	return true;
}
