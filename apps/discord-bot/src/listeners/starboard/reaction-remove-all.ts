import type { Message, PartialMessage } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

// A moderator clearing every reaction takes the message off the starboard.
@ApplyOptions<Listener.Options>({ event: Events.MessageReactionRemoveAll })
export class StarboardReactionRemoveAllListener extends Listener<
	typeof Events.MessageReactionRemoveAll
> {
	public override async run(message: Message | PartialMessage) {
		await this.container.starboard?.refresh(message);
	}
}
