export type ReplyMessage = {
	id: string;
	messageReference?: { message_id?: string } | null;
	message_reference?: { message_id?: string } | null;
};

function referencedId(message: ReplyMessage): string | undefined {
	return (message.messageReference ?? message.message_reference)?.message_id ?? undefined;
}

function compareIds(a: string, b: string): number {
	return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * @description Finds the earliest reply to a message among the given messages.
 * @param messages Messages in any order, as Discord stores or returns them.
 * @param messageId The message replied to.
 * @returns The first reply's id, or `undefined` when none of them replies to it.
 */
export function firstReplyTo(
	messages: readonly ReplyMessage[],
	messageId: string,
): string | undefined {
	return messages
		.filter((message) => referencedId(message) === messageId)
		.map((message) => message.id)
		.sort(compareIds)[0];
}

export default { firstReplyTo };
