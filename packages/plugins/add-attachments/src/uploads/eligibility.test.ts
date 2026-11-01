import { describe, expect, test } from 'bun:test';

import {
	attachmentLimitProblem,
	canAddAttachments,
	remainingAttachments,
} from '~/uploads/eligibility';

const own = { id: 'm', channel_id: 'c', type: 0, flags: 0, author: { id: 'me' }, attachments: [] };

function withAttachments(count: number) {
	return {
		...own,
		attachments: Array.from({ length: count }, (_, index) => ({ id: String(index) })),
	};
}

describe('canAddAttachments', () => {
	test('allows your own plain messages and replies', () => {
		expect(canAddAttachments(own, 'me')).toBe(true);
		expect(canAddAttachments({ ...own, type: 19 }, 'me')).toBe(true);
	});

	test('refuses other users, other message types and voice messages', () => {
		expect(canAddAttachments(own, 'someone')).toBe(false);
		expect(canAddAttachments(own, undefined)).toBe(false);
		expect(canAddAttachments({ ...own, type: 7 }, 'me')).toBe(false);
		expect(canAddAttachments({ ...own, flags: 1 << 13 }, 'me')).toBe(false);
	});

	test('refuses a message that already has ten attachments', () => {
		expect(canAddAttachments(withAttachments(9), 'me')).toBe(true);
		expect(canAddAttachments(withAttachments(10), 'me')).toBe(false);
	});
});

describe('attachment limit', () => {
	test('counts the room left', () => {
		expect(remainingAttachments(withAttachments(7))).toBe(3);
	});

	test('explains when files do not fit', () => {
		expect(attachmentLimitProblem(withAttachments(7), 3)).toBeNull();
		expect(attachmentLimitProblem(withAttachments(9), 2)).toBe(
			'You can only add 1 more attachment to this message.',
		);
		expect(attachmentLimitProblem(withAttachments(7), 4)).toBe(
			'You can only add 3 more attachments to this message.',
		);
		expect(attachmentLimitProblem(withAttachments(10), 1)).toBe(
			'You cannot add more attachments to this message.',
		);
	});
});
