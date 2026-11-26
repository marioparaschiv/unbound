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

	test("ends a message's own small text with the mark, on its line", () => {
		const own = { type: 'subtext', content: [{ type: 'text', content: 'footnote' }] };
		const sending = withReceipt([own], 'sending');

		expect(sending).toEqual([
			{
				type: 'subtext',
				content: [
					{ type: 'text', content: 'footnote' },
					{ type: 'text', content: ' 🕓' },
				],
			},
		]);
		expect(withReceipt(sending, 'acknowledged')).toEqual([
			{
				type: 'subtext',
				content: [
					{ type: 'text', content: 'footnote' },
					{ type: 'text', content: ' ✓' },
				],
			},
		]);
	});

	test('puts the mark inside a closing heading or quote', () => {
		const heading = { type: 'heading', content: [{ type: 'text', content: 'Plans' }] };

		expect(withReceipt([heading], 'acknowledged')).toEqual([
			{
				type: 'heading',
				content: [
					{ type: 'text', content: 'Plans' },
					{ type: 'subtext', content: [{ type: 'text', content: ' ✓' }] },
				],
			},
		]);
	});

	test('leaves a message ending in a code block or list unmarked', () => {
		const code = { type: 'codeBlock', content: 'ls' };
		const list = { type: 'list', content: [] };

		expect(withReceipt([code], 'acknowledged')).toEqual([code]);
		expect(withReceipt([list], 'failed')).toEqual([list]);
	});
});
