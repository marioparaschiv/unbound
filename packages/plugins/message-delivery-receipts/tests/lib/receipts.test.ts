import { describe, expect, test } from 'bun:test';

import { receiptOf, withReceipt } from '~/lib/receipts';

const rules = { sentHere: (nonce: string) => nonce === 'n1', allMessages: false };

describe('receipts', () => {
	test('marks sending and failed messages', () => {
		expect(receiptOf({ state: 'SENDING' }, rules)).toBe('sending');
		expect(receiptOf({ state: 'SEND_FAILED' }, rules)).toBe('failed');
	});

	test('marks acknowledged messages sent from this device', () => {
		expect(receiptOf({ state: 'SENT', nonce: 'n1' }, rules)).toBe('acknowledged');
		expect(receiptOf({ state: 'SENT', nonce: 'n2' }, rules)).toBeUndefined();
		expect(receiptOf({ state: 'SENT' }, rules)).toBeUndefined();
	});

	test('marks every acknowledged message when asked', () => {
		expect(receiptOf({ state: 'SENT' }, { ...rules, allMessages: true })).toBe('acknowledged');
	});

	test('puts the mark after the text as small text, once', () => {
		const text = { type: 'text', content: 'hi' };
		const acked = withReceipt([text], 'acknowledged');

		expect(acked).toEqual([
			text,
			{ type: 'subtext', content: [{ type: 'text', content: ' ✓' }] },
		]);
		expect(withReceipt(acked, 'failed')).toEqual([
			text,
			{ type: 'subtext', content: [{ type: 'text', content: ' ⚠' }] },
		]);
	});

	test("leaves a message's own small text alone", () => {
		const own = { type: 'subtext', content: [{ type: 'text', content: 'footnote' }] };

		expect(withReceipt([own], 'sending')).toEqual([
			own,
			{ type: 'subtext', content: [{ type: 'text', content: ' 🕓' }] },
		]);
	});
});
