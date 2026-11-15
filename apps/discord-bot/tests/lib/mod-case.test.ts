import { describe, expect, test } from 'bun:test';

import { auditReason, renderCaseField, type ModCase } from '~/lib/mod-case';

const CASE: ModCase = {
	id: 12,
	action: 'ban',
	userId: '100',
	userName: 'spam_bot',
	moderatorId: '200',
	moderatorName: 'mod_*',
	reason: 'Posting scams',
	expiresAt: new Date('2026-11-22T00:00:00.000Z'),
	closedAt: null,
	logChannelId: null,
	logMessageId: null,
	createdAt: new Date('2026-11-15T00:00:00.000Z'),
};

describe('renderCaseField', () => {
	test('lists the reason over the moderator, the time and the duration', () => {
		expect(renderCaseField(CASE)).toEqual({
			name: 'Case 12 · ban',
			value: 'Posting scams\n-# by mod\\_\\* · <t:1794700800:R> · 1 week',
		});
	});
});

describe('auditReason', () => {
	test("names the moderator and fits Discord's limit", () => {
		expect(auditReason('mod', null)).toBe('mod: No reason given.');
		expect(auditReason('mod', 'x'.repeat(600))).toHaveLength(512);
	});
});
