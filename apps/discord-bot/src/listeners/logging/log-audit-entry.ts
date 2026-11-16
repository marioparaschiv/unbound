import type { Guild, GuildAuditLogsEntry } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { auditLogEntry, type AuditExtra } from '~/lib/audit-log-post';

// discord.js types `extra` per action; this reads the parts any of them carry.
function readExtra(extra: GuildAuditLogsEntry['extra']): AuditExtra {
	if (!extra || typeof extra !== 'object') {
		return {};
	}

	return {
		channelId: 'channel' in extra && extra.channel ? extra.channel.id : undefined,
		messageId: 'messageId' in extra ? extra.messageId : undefined,
		count: 'count' in extra ? extra.count : undefined,
		removed: 'removed' in extra ? extra.removed : undefined,
		days: 'days' in extra ? extra.days : undefined,
		ruleName: 'autoModerationRuleName' in extra ? extra.autoModerationRuleName : undefined,
	};
}

/** Logs every audit log action not logged elsewhere, naming who took it; channel, role, emoji and server changes included. */
@ApplyOptions<Listener.Options>({ event: Events.GuildAuditLogEntryCreate })
export class LogAuditEntryListener extends Listener<typeof Events.GuildAuditLogEntryCreate> {
	public override async run(entry: GuildAuditLogsEntry, guild: Guild) {
		const { serverLog, config } = this.container;

		if (!serverLog || guild.id !== config.guildId) return;

		const log = auditLogEntry({
			guildId: guild.id,
			action: entry.action,
			actionType: entry.actionType,
			targetType: entry.targetType,
			targetId: entry.targetId,
			executorId: entry.executorId,
			reason: entry.reason,
			changes: entry.changes,
			extra: readExtra(entry.extra),
		});

		if (!log) return;

		await serverLog.post(log);
	}
}
