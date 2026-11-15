import type { MessageReaction, PartialMessageReaction } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { STAR } from '~/starboard/starboard';

// A moderator clearing every star takes the message off the starboard.
@ApplyOptions<Listener.Options>({ event: Events.MessageReactionRemoveEmoji })
export class StarboardReactionRemoveEmojiListener extends Listener<
	typeof Events.MessageReactionRemoveEmoji
> {
	public override async run(reaction: MessageReaction | PartialMessageReaction) {
		if (reaction.emoji.name !== STAR) return;

		await this.container.starboard?.refresh(reaction.message);
	}
}
