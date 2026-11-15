import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

/** How far back a softban deletes the member's messages. */
const DELETE_MESSAGE_SECONDS = 86_400;

@ApplyOptions<Command.Options>({
	name: 'softban',
	description: "Kicks a member and deletes their past day's messages, then records a case.",
	requiredUserPermissions: ['BanMembers'],
	requiredClientPermissions: ['BanMembers'],
	preconditions: ['unbound'],
})
export class SoftbanCommand extends ModerationActionCommand {
	protected readonly action = 'softban';

	// A ban deletes the messages, and the unban right after lets the member rejoin.
	protected async apply(guild: Guild, { user, auditReason }: ActionInput) {
		await guild.bans.create(user.id, {
			reason: auditReason,
			deleteMessageSeconds: DELETE_MESSAGE_SECONDS,
		});
		await guild.bans.remove(user.id, auditReason);
	}
}
