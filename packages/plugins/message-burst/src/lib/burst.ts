/** The previous message, as the merge decision reads it. */
export type LastMessage = {
	authorId?: string;
	sentAt: number;
	sent: boolean;
	attachments: number;
	content: string;
};

/** What the merge decision depends on besides the two messages. */
export type BurstRules = {
	me: string;
	now: number;
	seconds: number;
	attachments: boolean;
	replying: boolean;
	maxLength: number;
	separator: string;
};

/**
 * @description Decides whether a new message merges into the previous one, and with what text: only into your own sent
 * message from the last few seconds, never while replying, and only when the result still fits.
 * @param last The channel's last message, or `undefined` in an empty channel.
 * @param content The new message's text.
 * @param rules Who you are, the time, the settings, whether a reply is pending and the length limit.
 * @returns The merged text, or `undefined` to send the message normally.
 */
export function burstContent(
	last: LastMessage | undefined,
	content: string,
	rules: BurstRules,
): string | undefined {
	if (!last || !content.trim() || rules.replying || !last.sent || last.authorId !== rules.me)
		return undefined;
	if (rules.now - last.sentAt > rules.seconds * 1000) return undefined;
	if (last.attachments > 0 && !rules.attachments) return undefined;

	const merged = last.content ? `${last.content}${rules.separator}${content}` : content;

	return merged.length <= rules.maxLength ? merged : undefined;
}

export default burstContent;
