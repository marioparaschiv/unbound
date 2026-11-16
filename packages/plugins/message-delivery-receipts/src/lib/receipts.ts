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

/**
 * @description Adds a receipt's mark to the label Discord shows after a message's text, next to "edited".
 * @param label The current label, empty for an unedited message.
 * @param receipt The receipt.
 * @returns The label with the mark.
 */
export function withReceiptMark(label: string, receipt: Receipt): string {
	const mark = MARKS[receipt];

	if (label.endsWith(mark)) return label;

	return label ? `${label} · ${mark}` : mark;
}

export default { receiptOf, withReceiptMark };
