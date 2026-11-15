import { AuditLogEvent, type AuditLogChange } from 'discord.js';

import type { CaseAction } from '~/db/schema';

/** The parts of a Discord audit log entry that say which moderation action it was. */
export type AuditEntryFacts = { action: AuditLogEvent; changes: readonly AuditLogChange[] };

/** The case an audit log entry stands for. */
export type AuditCase = { action: CaseAction; expiresAt?: Date };

const DIRECT: Partial<Record<AuditLogEvent, CaseAction>> = {
	[AuditLogEvent.MemberBanAdd]: 'ban',
	[AuditLogEvent.MemberBanRemove]: 'unban',
	[AuditLogEvent.MemberKick]: 'kick',
};

/**
 * @description Reads which case an action taken in Discord itself stands for, as Carl-bot logged manual bans, kicks and timeouts.
 * @param entry The audit log entry's action and changes.
 * @returns The case action, with a timeout's end; undefined for anything that is not a moderation action.
 */
export function auditCaseOf({ action, changes }: AuditEntryFacts): AuditCase | undefined {
	const direct = DIRECT[action];

	if (direct) {
		return { action: direct };
	}

	if (action !== AuditLogEvent.MemberUpdate) return;

	const timeout = changes.find((change) => change.key === 'communication_disabled_until');

	if (!timeout) return;

	if (typeof timeout.new === 'string') {
		return { action: 'mute', expiresAt: new Date(timeout.new) };
	}

	return typeof timeout.old === 'string' ? { action: 'unmute' } : undefined;
}

export default { auditCaseOf };
