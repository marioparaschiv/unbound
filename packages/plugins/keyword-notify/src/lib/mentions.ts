export type MentionedMessage = {
	content?: string;
	author?: { id?: string; bot?: boolean };
	mentions?: { id?: string }[];
	embeds?: { title?: string; description?: string }[];
};

export type MentionRules = {
	currentUserId: string | undefined;
	ignoreBots: boolean;
	matches(text: string): boolean;
};

function searchableText({ content = '', embeds = [] }: MentionedMessage): string {
	return [
		content,
		...embeds.flatMap((embed) => [embed.title ?? '', embed.description ?? '']),
	].join('\n');
}

/**
 * @description Adds the current user to a message's mentions when it contains a keyword, unless they wrote it or are already mentioned.
 * @param message The message as the gateway or the history request delivered it, changed in place.
 * @param rules Who the current user is, whether bots count, and the keyword test.
 * @returns Whether the message now mentions the current user because of a keyword.
 */
export function mentionOnKeyword(
	message: MentionedMessage | undefined,
	rules: MentionRules,
): boolean {
	const { currentUserId } = rules;
	const author = message?.author;

	if (!message || !currentUserId || !author || author.id === currentUserId) return false;
	if (rules.ignoreBots && author.bot) return false;
	if (message.mentions?.some((user) => user.id === currentUserId)) return false;
	if (!rules.matches(searchableText(message))) return false;

	message.mentions = [...(message.mentions ?? []), { id: currentUserId }];

	return true;
}

export default { mentionOnKeyword };
