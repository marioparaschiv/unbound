import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

@ApplyOptions<Command.Options>({
	name: 'warn',
	description: 'Warns a member and records a case.',
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class WarnCommand extends ModerationActionCommand {
	protected readonly action = 'warn';

	// A warning is the case and the DM alone.
	protected apply(_guild: Guild, _input: ActionInput) {
		return Promise.resolve();
	}
}
