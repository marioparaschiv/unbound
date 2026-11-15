import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';
import type { Guild } from 'discord.js';

import { ModerationActionCommand, type ActionInput } from '~/moderation/action-command';

/** Discord's longest timeout. */
const MAX_TIMEOUT_MS = 28 * 86_400_000;

@ApplyOptions<Command.Options>({
	name: 'mute',
	description: 'Times a member out, for up to 28 days, and records a case.',
	aliases: ['timeout'],
	requiredUserPermissions: ['ModerateMembers'],
	requiredClientPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class MuteCommand extends ModerationActionCommand {
	protected readonly action = 'mute';
	protected override readonly maxDurationMs = MAX_TIMEOUT_MS;
	// Carl-bot's mute lasted until an unmute; Discord's longest timeout is the nearest.
	protected override readonly defaultDurationMs = MAX_TIMEOUT_MS;

	protected async apply(_guild: Guild, { member, durationMs, auditReason }: ActionInput) {
		await member?.timeout(durationMs ?? MAX_TIMEOUT_MS, auditReason);
	}
}
