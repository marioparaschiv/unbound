import { describe, expect, test } from 'bun:test';

import { receiptOf, withReceiptMark } from '~/lib/receipts';

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

	test('puts the mark after "edited" once', () => {
		expect(withReceiptMark('', 'acknowledged')).toBe('✓');
		expect(withReceiptMark('edited', 'sending')).toBe('edited · 🕓');
		expect(withReceiptMark('edited · ✓', 'acknowledged')).toBe('edited · ✓');
	});
});
