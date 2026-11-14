/** A message as the row builder gets it, as far as replies go. */
export type ReplyMessage = {
	author?: { id?: string };
	messageReference?: { message_id?: string; messageId?: string } | null;
	message_reference?: { message_id?: string } | null;
};

/**
 * @description Reads the id of the message a reply answers.
 * @param message The message.
 * @returns The replied-to message's id, or `undefined` for a message that is not a reply.
 */
export function repliedToId(message: ReplyMessage | undefined): string | undefined {
	const reference = message?.messageReference ?? message?.message_reference;

	return (
		(reference as { message_id?: string; messageId?: string } | null | undefined)?.message_id ??
		(reference as { messageId?: string } | null | undefined)?.messageId
	);
}

/**
 * @description Tells whether a message replies to one of yours, sent by someone else.
 * @param message The message.
 * @param myId Your user id.
 * @param authorOf Reads who wrote a message, from what Discord has loaded.
 * @returns Whether to highlight it.
 */
export function repliesToMe(
	message: ReplyMessage | undefined,
	myId: string | undefined,
	authorOf: (messageId: string) => string | undefined,
): boolean {
	const target = repliedToId(message);

	if (!target || !myId || message?.author?.id === myId) return false;

	return authorOf(target) === myId;
}
