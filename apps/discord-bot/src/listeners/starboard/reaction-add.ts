import type { MessageReaction, PartialMessageReaction } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { STAR } from '~/starboard/starboard';

@ApplyOptions<Listener.Options>({ event: Events.MessageReactionAdd })
export class StarboardReactionAddListener extends Listener<typeof Events.MessageReactionAdd> {
	public override async run(reaction: MessageReaction | PartialMessageReaction) {
		if (reaction.emoji.name !== STAR) return;

		await this.container.starboard?.refresh(reaction.message);
	}
}
