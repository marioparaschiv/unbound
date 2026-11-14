export type ChatRow = {
	type?: number;
	message?: {
		authorId?: string;
		content?: ContentNode[] | string;
		referencedMessage?: { message?: { authorId?: string } };
	};
};

export type ContentNode = { content?: ContentNode[] | string; type?: string };

export type HideRules = {
	isHidden(userId: string): boolean;
	hidesContent?(content: string): boolean;
	replies: boolean;
};

const BLOCKED_ROW = 2;

/**
 * @description Joins the text of a chat row's parsed content, which Discord hands rows as a tree of markdown nodes.
 * @param content The row's content: the node tree, or plain text.
 * @returns The text of every node in order.
 */
export function contentText(content: ContentNode[] | string | undefined): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	return content.map((node) => contentText(node.content)).join('');
}

/**
 * @description Decides whether a chat row disappears: Discord's placeholder for a blocked message, a message from a hidden author or with a hidden keyword, or a reply to a hidden author.
 * @param row The row Discord's row manager generated.
 * @param rules Who is hidden, and whether replies to them go too.
 * @returns Whether to leave the row out.
 */
export function isHiddenRow(row: ChatRow | undefined, rules: HideRules): boolean {
	if (!row) return false;
	if (row.type === BLOCKED_ROW) return true;

	const author = row.message?.authorId;

	if (author && rules.isHidden(author)) return true;

	const content = contentText(row.message?.content);

	if (content && rules.hidesContent?.(content)) return true;

	const repliedTo = row.message?.referencedMessage?.message?.authorId;

	return Boolean(rules.replies && repliedTo && rules.isHidden(repliedTo));
}

export default { isHiddenRow };
