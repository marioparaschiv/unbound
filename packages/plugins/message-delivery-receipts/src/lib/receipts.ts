export type Receipt = 'sending' | 'failed' | 'acknowledged';

export type ReceiptMessage = { state?: string; nonce?: string | null; id?: string };

export type ReceiptRules = {
	sentHere: (nonce: string) => boolean;
	allMessages: boolean;
};

const MARKS: Record<Receipt, string> = { sending: '🕓', failed: '⚠', acknowledged: '✓' };

/**
 * @description Works out what a message of yours shows: still sending, failed, or acknowledged by Discord's server.
 * Messages loaded from history are only marked acknowledged when `allMessages` is set.
 * @param message Your message.
 * @param rules Which nonces were sent from this device, and whether to mark every acknowledged message.
 * @returns The receipt, or `undefined` for none.
 */
export function receiptOf(
	message: ReceiptMessage,
	{ sentHere, allMessages }: ReceiptRules,
): Receipt | undefined {
	if (message.state === 'SENDING') return 'sending';
	if (message.state === 'SEND_FAILED') return 'failed';
	if (message.state !== 'SENT') return undefined;
	if (allMessages || (message.nonce && sentHere(message.nonce))) return 'acknowledged';

	return undefined;
}

export type ContentNode = { type: string; content?: unknown };

const RECEIPT_TYPE = 'subtext';

function receiptNode(receipt: Receipt): ContentNode {
	return { type: RECEIPT_TYPE, content: [{ type: 'text', content: ` ${MARKS[receipt]}` }] };
}

function isReceiptNode(node: ContentNode | undefined): boolean {
	const text = Array.isArray(node?.content)
		? (node.content[0] as ContentNode | undefined)?.content
		: undefined;

	return (
		node?.type === RECEIPT_TYPE &&
		typeof text === 'string' &&
		Object.values(MARKS).some((mark) => text === ` ${mark}`)
	);
}

/**
 * @description Ends a message's content with its receipt as small muted text on the same line, the way chat apps
 * put ticks after a message, replacing a receipt it already ends with.
 * @param content The row's content nodes.
 * @param receipt The receipt.
 * @returns The content with the receipt last.
 */
export function withReceipt(content: ContentNode[], receipt: Receipt): ContentNode[] {
	const kept = isReceiptNode(content.at(-1)) ? content.slice(0, -1) : content;

	return [...kept, receiptNode(receipt)];
}

export default { receiptOf, withReceipt };
