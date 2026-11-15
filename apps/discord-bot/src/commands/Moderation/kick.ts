import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

@ApplyOptions<Command.Options>({
	name: 'kick',
	description: 'Kicks a member and records a case.',
	requiredUserPermissions: ['KickMembers'],
	requiredClientPermissions: ['KickMembers'],
	preconditions: ['unbound'],
})
export class KickCommand extends ModerationActionCommand {
	protected readonly action = 'kick';

	protected async apply(_guild: Guild, { member, auditReason }: ActionInput) {
		await member?.kick(auditReason);
	}
}
