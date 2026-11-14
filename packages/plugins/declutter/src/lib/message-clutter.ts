/** The parts of a rendered message row Declutter clears. */
export type MessageContent = {
	avatarDecorationURL?: string | null;
	clanTagGuildId?: string | null;
	clanTag?: string | null;
	clanBadgeUrl?: string | null;
	displayNameStyles?: unknown;
	referencedMessage?: { message?: MessageContent };
};

/** Which message parts to clear. */
export type MessageClutter = {
	avatarDecorations: boolean;
	serverTags: boolean;
	displayNameStyles: boolean;
};

const TAG_KEYS = ['clanTagGuildId', 'clanTag', 'clanBadgeUrl'] as const;

/**
 * @description Clears avatar decorations, server tags and display name styles from a message row, and server tags from its reply preview.
 * @param content The row Discord built.
 * @param clutter Which parts to clear.
 * @returns The row without them, or the same row when nothing changed.
 */
export function withoutMessageClutter(
	content: MessageContent,
	clutter: MessageClutter,
): MessageContent {
	const changes: Partial<MessageContent> = {};

	if (clutter.avatarDecorations && content.avatarDecorationURL != null) {
		changes.avatarDecorationURL = null;
	}

	if (clutter.displayNameStyles && content.displayNameStyles != null) {
		changes.displayNameStyles = null;
	}

	if (clutter.serverTags) {
		for (const key of TAG_KEYS) {
			if (content[key] != null) changes[key] = null;
		}

		const reply = content.referencedMessage?.message;
		const cleared = reply
			? withoutMessageClutter(reply, {
					avatarDecorations: false,
					serverTags: true,
					displayNameStyles: false,
				})
			: reply;

		if (reply && cleared !== reply) {
			changes.referencedMessage = { ...content.referencedMessage, message: cleared };
		}
	}

	return Object.keys(changes).length ? { ...content, ...changes } : content;
}

export default withoutMessageClutter;
