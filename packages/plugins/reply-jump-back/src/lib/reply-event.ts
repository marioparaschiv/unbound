type ReplyEvent = { nativeEvent?: { originId?: unknown } };

/**
 * @description Reads which message's reply preview was tapped from the chat's native event.
 * @param event The event Discord's chat passes to `onTapMessageReply`.
 * @returns The replying message's ID, or `undefined` when the event carries none.
 */
export function tappedReplyId(event: unknown): string | undefined {
	const id = (event as ReplyEvent | null)?.nativeEvent?.originId;

	return typeof id === 'string' ? id : undefined;
}

export default tappedReplyId;
