import { describe, expect, test } from 'bun:test';

import { isHiddenRow, type ChatRow } from '~/lib/hidden';

const hidden = new Set(['7']);
const rules = { isHidden: (id: string) => hidden.has(id), replies: true };

function messageRow(authorId: string, repliedTo?: string): ChatRow {
	return {
		type: 1,
		message: {
			authorId,
			referencedMessage: repliedTo ? { message: { authorId: repliedTo } } : undefined,
		},
	};
}

describe('hidden rows', () => {
	test("hides Discord's blocked placeholder and hidden authors", () => {
		expect(isHiddenRow({ type: 2 }, rules)).toBe(true);
		expect(isHiddenRow(messageRow('7'), rules)).toBe(true);
		expect(isHiddenRow(messageRow('8'), rules)).toBe(false);
	});

	test('hides replies to hidden authors only while replies are hidden', () => {
		expect(isHiddenRow(messageRow('8', '7'), rules)).toBe(true);
		expect(isHiddenRow(messageRow('8', '7'), { ...rules, replies: false })).toBe(false);
	});

	test('keeps rows without a message', () => {
		expect(isHiddenRow(undefined, rules)).toBe(false);
		expect(isHiddenRow({ type: 3 }, rules)).toBe(false);
	});

	test('hides messages whose content has a hidden keyword', () => {
		const withKeywords = {
			...rules,
			hidesContent: (content: string) => content.includes('spoiler'),
		};

		expect(
			isHiddenRow(
				{ type: 1, message: { authorId: '8', content: 'big spoiler' } },
				withKeywords,
			),
		).toBe(true);
		expect(
			isHiddenRow({ type: 1, message: { authorId: '8', content: 'hello' } }, withKeywords),
		).toBe(false);
		expect(
			isHiddenRow(
				{
					type: 1,
					message: {
						authorId: '8',
						content: [
							{ type: 'strong', content: [{ type: 'text', content: 'spoil' }] },
							{ type: 'text', content: 'er!' },
						],
					},
				},
				withKeywords,
			),
		).toBe(true);
	});
});
