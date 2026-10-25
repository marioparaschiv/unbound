import type { CommandInteraction, ContextMenuCommandInteraction, Guild, Message } from 'discord.js';
import { Precondition } from '@sapphire/framework';

import { GUILD_ID } from '~/lib/constants';

export class UnboundPrecondition extends Precondition {
	public override messageRun(message: Message) {
		return this.checkEligibility(message.guild);
	}

	public override chatInputRun(interaction: CommandInteraction) {
		return this.checkEligibility(interaction.guild);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return this.checkEligibility(interaction.guild);
	}

	private checkEligibility(guild: Guild | null) {
		if (!guild) {
			return this.error({ message: 'I am not available in DMs.' });
		}

		if (guild.id !== GUILD_ID) {
			return this.error({ message: 'I am not available in this server.' });
		}

		return this.ok();
	}
}
