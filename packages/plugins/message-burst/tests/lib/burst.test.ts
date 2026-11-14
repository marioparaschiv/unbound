import { describe, expect, test } from 'bun:test';

import { burstContent, type BurstRules } from '~/lib/burst';

const rules: BurstRules = {
	me: '1',
	now: 10_000,
	seconds: 3,
	attachments: false,
	replying: false,
	maxLength: 2000,
	separator: '\n',
};

const last = { authorId: '1', sentAt: 8_000, sent: true, attachments: 0, content: 'first' };

describe('burstContent', () => {
	test('merges a quick follow-up into your own message', () => {
		expect(burstContent(last, 'second', rules)).toBe('first\nsecond');
		expect(burstContent(last, 'second', { ...rules, separator: ' ' })).toBe('first second');
	});

	test('sends normally when the burst does not apply', () => {
		expect(burstContent({ ...last, authorId: '2' }, 'x', rules)).toBeUndefined();
		expect(burstContent({ ...last, sentAt: 1_000 }, 'x', rules)).toBeUndefined();
		expect(burstContent({ ...last, sent: false }, 'x', rules)).toBeUndefined();
		expect(burstContent(last, 'x', { ...rules, replying: true })).toBeUndefined();
		expect(burstContent(last, '   ', rules)).toBeUndefined();
		expect(burstContent(undefined, 'x', rules)).toBeUndefined();
		expect(burstContent(last, 'x'.repeat(2000), rules)).toBeUndefined();
	});

	test('merges into messages with attachments only when allowed', () => {
		expect(burstContent({ ...last, attachments: 1 }, 'x', rules)).toBeUndefined();
		expect(
			burstContent({ ...last, attachments: 1, content: '' }, 'x', {
				...rules,
				attachments: true,
			}),
		).toBe('x');
	});
});
