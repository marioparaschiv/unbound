import { describe, expect, test } from 'bun:test';
import { AuditLogEvent } from 'discord.js';

import { auditCaseOf } from '~/lib/audit-cases';

const UNTIL = '2026-11-20T00:00:00.000Z';

describe('auditCaseOf', () => {
	test('reads bans, unbans and kicks', () => {
		expect(auditCaseOf({ action: AuditLogEvent.MemberBanAdd, changes: [] })).toEqual({
			action: 'ban',
		});
		expect(auditCaseOf({ action: AuditLogEvent.MemberBanRemove, changes: [] })).toEqual({
			action: 'unban',
		});
		expect(auditCaseOf({ action: AuditLogEvent.MemberKick, changes: [] })).toEqual({
			action: 'kick',
		});
	});

	test('reads a timeout set as a mute until its end, and one cleared as an unmute', () => {
		expect(
			auditCaseOf({
				action: AuditLogEvent.MemberUpdate,
				changes: [{ key: 'communication_disabled_until', new: UNTIL }],
			}),
		).toEqual({ action: 'mute', expiresAt: new Date(UNTIL) });
		expect(
			auditCaseOf({
				action: AuditLogEvent.MemberUpdate,
				changes: [{ key: 'communication_disabled_until', old: UNTIL }],
			}),
		).toEqual({ action: 'unmute' });
	});

	test('ignores other member updates and other actions', () => {
		expect(
			auditCaseOf({
				action: AuditLogEvent.MemberUpdate,
				changes: [{ key: 'nick', new: 'a' }],
			}),
		).toBeUndefined();
		expect(auditCaseOf({ action: AuditLogEvent.ChannelCreate, changes: [] })).toBeUndefined();
	});
});
