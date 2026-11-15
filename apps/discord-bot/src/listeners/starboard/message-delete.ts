import type { Message, PartialMessage } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Listener.Options>({ event: Events.MessageDelete })
export class StarboardMessageDeleteListener extends Listener<typeof Events.MessageDelete> {
	public override async run(message: Message | PartialMessage) {
		await this.container.starboard?.forget(message);
	}
}
