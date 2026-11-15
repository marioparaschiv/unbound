import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

@ApplyOptions<Command.Options>({
	name: 'unmute',
	description: "Ends a member's timeout and records a case.",
	aliases: ['untimeout'],
	requiredUserPermissions: ['ModerateMembers'],
	requiredClientPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class UnmuteCommand extends ModerationActionCommand {
	protected readonly action = 'unmute';

	protected override check(_guild: Guild, { member }: ActionInput) {
		return Promise.resolve(
			member?.isCommunicationDisabled() ? undefined : '{user} is not muted.',
		);
	}

	protected async apply(_guild: Guild, { member, auditReason }: ActionInput) {
		await member?.timeout(null, auditReason);
	}
}
