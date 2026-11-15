import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';
import { discordFailure } from '~/lib/discord-messages';

@ApplyOptions<Command.Options>({
	name: 'unban',
	description: 'Unbans a user and records a case.',
	requiredUserPermissions: ['BanMembers'],
	requiredClientPermissions: ['BanMembers'],
	preconditions: ['unbound'],
})
export class UnbanCommand extends ModerationActionCommand {
	protected readonly action = 'unban';
	protected override readonly needsMember = false;

	protected override async check(guild: Guild, { user }: ActionInput) {
		try {
			await guild.bans.fetch({ user: user.id, force: true });

			return undefined;
		} catch (error) {
			if (discordFailure(error) !== 'gone') {
				throw error;
			}

			return '{user} is not banned.';
		}
	}

	protected async apply(guild: Guild, { user, auditReason }: ActionInput) {
		await guild.bans.remove(user.id, auditReason);
	}
}
