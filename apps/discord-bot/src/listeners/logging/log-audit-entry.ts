import type { Guild, GuildAuditLogsEntry } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { auditLogEntry } from '~/lib/audit-log-post';

/** Logs every audit log action not logged elsewhere, naming who took it; channel, role, emoji and server changes included. */
@ApplyOptions<Listener.Options>({ event: Events.GuildAuditLogEntryCreate })
export class LogAuditEntryListener extends Listener<typeof Events.GuildAuditLogEntryCreate> {
	public override async run(entry: GuildAuditLogsEntry, guild: Guild) {
		const { serverLog, config } = this.container;

		if (!serverLog || guild.id !== config.guildId) return;

		const { extra } = entry;
		const log = auditLogEntry({
			action: entry.action,
			actionType: entry.actionType,
			targetType: entry.targetType,
			targetId: entry.targetId,
			executorId: entry.executorId,
			reason: entry.reason,
			changes: entry.changes,
			channelId:
				extra && typeof extra === 'object' && 'channel' in extra
					? extra.channel.id
					: undefined,
		});

		if (!log) return;

		await serverLog.post(log);
	}
}
