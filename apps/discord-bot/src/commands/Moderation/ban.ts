import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

@ApplyOptions<Command.Options>({
	name: 'ban',
	description: 'Bans a user, for good or for a duration, and records a case.',
	requiredUserPermissions: ['BanMembers'],
	requiredClientPermissions: ['BanMembers'],
	preconditions: ['unbound'],
})
export class BanCommand extends ModerationActionCommand {
	protected readonly action = 'ban';
	// A user who already left can still be banned, as Carl-bot's hackban did.
	protected override readonly needsMember = false;
	protected override readonly maxDurationMs = Number.POSITIVE_INFINITY;

	protected async apply(guild: Guild, { user, auditReason }: ActionInput) {
		await guild.bans.create(user.id, { reason: auditReason });
	}
}
