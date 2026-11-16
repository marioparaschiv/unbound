import { AuditLogEvent, type AuditLogChange } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import { auditLogEntry, auditTitle, type AuditLogFacts } from '~/lib/audit-log-post';

const FACTS: AuditLogFacts = {
	action: AuditLogEvent.ChannelUpdate,
	actionType: 'Update',
	targetType: 'Channel',
	targetId: '300',
	executorId: '200',
	reason: null,
	changes: [],
};

describe('auditTitle', () => {
	test('titles actions in title case and the past tense', () => {
		expect(auditTitle(AuditLogEvent.ChannelCreate)).toBe('Channel Created');
		expect(auditTitle(AuditLogEvent.MessagePin)).toBe('Message Pinned');
		expect(auditTitle(AuditLogEvent.GuildUpdate)).toBe('Server Updated');
		expect(auditTitle(AuditLogEvent.AutoModerationRuleCreate)).toBe('AutoMod Rule Created');
		expect(auditTitle(AuditLogEvent.MemberRoleUpdate)).toBe('Member Roles Updated');
	});
});

describe('auditLogEntry', () => {
	test('names the target, who did it and what changed', () => {
		const changes = [
			{ key: 'name', old: 'general', new: 'chat' },
			{ key: 'parent_id', old: '1', new: '2' },
		] as AuditLogChange[];
		const entry = auditLogEntry({ ...FACTS, changes, reason: 'tidy up' });

		expect(entry).toMatchObject({
			kind: 'misc',
			title: 'Channel Updated',
			icon: 'auditUpdated',
		});
		expect(entry?.lines?.filter(Boolean)).toEqual([
			'**Channel:** <#300>',
			'**By:** <@200> (200)',
			'**Reason:**\ntidy up',
			'**Changes:**\n**Name:** general → chat\n**Category:** <#1> → <#2>',
		]);
		expect(entry?.footer).toBe('300');
	});

	test('shows a member target as the user, and roles given by mention', () => {
		const changes = [
			{ key: '$add', new: [{ id: '9', name: 'Contributor' }] },
		] as AuditLogChange[];
		const entry = auditLogEntry({
			...FACTS,
			action: AuditLogEvent.MemberRoleUpdate,
			targetType: 'User',
			targetId: '100',
			changes,
		});

		expect(entry?.user?.id).toBe('100');
		expect(entry?.footer).toBeUndefined();
		expect(entry?.lines).toContain('**Changes:**\n**Roles added:** <@&9>');
	});

	test('names permission changes on a role', () => {
		const changes = [{ key: 'permissions', old: '0', new: '8' }] as AuditLogChange[];
		const entry = auditLogEntry({
			...FACTS,
			action: AuditLogEvent.RoleUpdate,
			targetType: 'Role',
			changes,
		});

		expect(entry?.lines).toContain('**Changes:**\n**Permissions added:** Administrator');
	});

	test('leaves bans, timeouts and message deletes to their own logs', () => {
		expect(auditLogEntry({ ...FACTS, action: AuditLogEvent.MemberBanAdd })).toBeUndefined();
		expect(auditLogEntry({ ...FACTS, action: AuditLogEvent.MessageDelete })).toBeUndefined();
		expect(
			auditLogEntry({
				...FACTS,
				action: AuditLogEvent.MemberUpdate,
				changes: [
					{ key: 'communication_disabled_until', new: '2026-11-20T00:00:00.000Z' },
				] as AuditLogChange[],
			}),
		).toBeUndefined();
	});
});
