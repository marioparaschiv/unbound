import type { Guild, GuildAuditLogsEntry } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { auditCaseOf } from '~/lib/audit-cases';
import { quote } from '~/lib/message-text';
import { COLOURS } from '~/lib/constants';
import { stamp } from '~/lib/mod-case';

/**
 * Logs a timeout given or lifted, whoever did it, as Carl-bot did. Read from the audit log, since member
 * updates need the members intent.
 */
@ApplyOptions<Listener.Options>({ event: Events.GuildAuditLogEntryCreate })
export class LogTimeoutListener extends Listener<typeof Events.GuildAuditLogEntryCreate> {
	public override async run(entry: GuildAuditLogsEntry, guild: Guild) {
		const { serverLog, config, client, logger } = this.container;

		if (!serverLog || guild.id !== config.guildId || !entry.targetId) return;

		const found = auditCaseOf(entry);

		if (found?.action !== 'mute' && found?.action !== 'unmute') return;

		try {
			const user = await client.users.fetch(entry.targetId);
			const by = entry.executorId ? `by <@${entry.executorId}>` : '';
			const until = found.expiresAt ? ` until ${stamp(found.expiresAt, 'f')}` : '';

			await serverLog.post({
				kind: 'moderation',
				title: found.action === 'mute' ? 'Member timed out' : 'Timeout removed',
				colour: found.action === 'mute' ? COLOURS.warning : COLOURS.positive,
				user: { id: user.id, name: user.username },
				lines: [`${by}${until}`, entry.reason ? quote(entry.reason) : ''],
			});
		} catch (error) {
			logger.error(`Failed to log the timeout of user ${entry.targetId}:`, error);
		}
	}
}
