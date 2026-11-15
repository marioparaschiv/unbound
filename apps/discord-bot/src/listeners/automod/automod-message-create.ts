import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

/** Runs every new server message past automod. */
@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class AutomodMessageCreateListener extends Listener<typeof Events.MessageCreate> {
	public override async run(message: Message) {
		if (!message.inGuild()) return;

		await this.container.automod?.inspect(message);
	}
}
