import type { Guild, GuildAuditLogsEntry } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { auditCaseOf } from '~/lib/audit-cases';

/** Records bans, kicks and timeouts taken in Discord itself, as Carl-bot did, so the mod log misses none. */
@ApplyOptions<Listener.Options>({ event: Events.GuildAuditLogEntryCreate })
export class ModerationAuditLogEntryListener extends Listener<
	typeof Events.GuildAuditLogEntryCreate
> {
	public override async run(entry: GuildAuditLogsEntry, guild: Guild) {
		const { moderation, config, client, logger } = this.container;
		const { targetId, executorId } = entry;

		// The bot records its own actions as it takes them.
		if (!moderation || guild.id !== config.guildId || executorId === client.user?.id) return;

		const found = auditCaseOf(entry);

		if (!found || !targetId || !executorId) return;

		try {
			const [user, executor] = await Promise.all([
				client.users.fetch(targetId),
				client.users.fetch(executorId),
			]);

			await moderation.record({
				action: found.action,
				userId: user.id,
				userName: user.username,
				moderatorId: executor.id,
				moderatorName: executor.username,
				reason: entry.reason,
				expiresAt: found.expiresAt ?? null,
			});
		} catch (error) {
			logger.error(`Failed to record the ${found.action} of user ${targetId}:`, error);
		}
	}
}
