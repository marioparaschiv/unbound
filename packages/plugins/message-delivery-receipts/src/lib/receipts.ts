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

// Blocks that end their own line, so a mark after them would sit alone on the next one.
const INLINE_BLOCKS = new Set(['subtext', 'heading', 'blockQuote']);
const CLOSED_BLOCKS = new Set(['codeBlock', 'list']);

function markText(receipt: Receipt): ContentNode {
	return { type: 'text', content: ` ${MARKS[receipt]}` };
}

function receiptNode(receipt: Receipt): ContentNode {
	return { type: RECEIPT_TYPE, content: [markText(receipt)] };
}

function isMarkText(node: ContentNode | undefined): boolean {
	const text = node?.content;

	return (
		node?.type === 'text' &&
		typeof text === 'string' &&
		Object.values(MARKS).some((mark) => text === ` ${mark}`)
	);
}

function isReceiptNode(node: ContentNode | undefined): boolean {
	const inner = Array.isArray(node?.content) ? node.content : [];

	return node?.type === RECEIPT_TYPE && inner.length === 1 && isMarkText(inner[0]);
}

/**
 * @description Ends a message's content with its receipt as small muted text on the same line, the way chat apps
 * put ticks after a message, replacing a receipt it already ends with. A message ending in small text, a heading or a
 * quote gets the mark inside that block; one ending in a code block or list gets none, as no line has room for it.
 * @param content The row's content nodes.
 * @param receipt The receipt.
 * @returns The content with the receipt last.
 */
export function withReceipt(content: ContentNode[], receipt: Receipt): ContentNode[] {
	const kept = isReceiptNode(content.at(-1)) ? content.slice(0, -1) : content;
	const last = kept.at(-1);

	if (last && CLOSED_BLOCKS.has(last.type)) return kept;

	if (last && INLINE_BLOCKS.has(last.type) && Array.isArray(last.content)) {
		const inner = last.content as ContentNode[];
		const marked =
			last.type === RECEIPT_TYPE
				? [...(isMarkText(inner.at(-1)) ? inner.slice(0, -1) : inner), markText(receipt)]
				: withReceipt(inner, receipt);

		return [...kept.slice(0, -1), { ...last, content: marked }];
	}

	return [...kept, receiptNode(receipt)];
}

export default { receiptOf, withReceipt };
