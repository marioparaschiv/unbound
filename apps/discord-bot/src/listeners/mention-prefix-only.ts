import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.MentionPrefixOnly })
export class MentionPrefixOnlyListener extends Listener<typeof Events.MentionPrefixOnly> {
	public override async run(message: Message) {
		const { defaultPrefix } = this.container.client.options;

		if (!message.channel.isSendable()) return;

		return message.channel.send(
			defaultPrefix
				? `My prefix in this guild is: \`${String(defaultPrefix)}\``
				: 'Cannot find any Prefix for Message Commands.',
		);
	}
}
