export type ChatRow = {
	type?: number;
	message?: {
		authorId?: string;
		referencedMessage?: { message?: { authorId?: string } };
	};
};

export type HideRules = {
	isHidden(userId: string): boolean;
	replies: boolean;
};

const BLOCKED_ROW = 2;

/**
 * @description Decides whether a chat row disappears: Discord's placeholder for a blocked message, a message from a hidden author, or a reply to one.
 * @param row The row Discord's row manager generated.
 * @param rules Who is hidden, and whether replies to them go too.
 * @returns Whether to leave the row out.
 */
export function isHiddenRow(row: ChatRow | undefined, rules: HideRules): boolean {
	if (!row) return false;
	if (row.type === BLOCKED_ROW) return true;

	const author = row.message?.authorId;

	if (author && rules.isHidden(author)) return true;

	const repliedTo = row.message?.referencedMessage?.message?.authorId;

	return Boolean(rules.replies && repliedTo && rules.isHidden(repliedTo));
}

export default { isHiddenRow };
