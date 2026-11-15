import { Events, Listener, type UnknownMessageCommandPayload } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { findTag } from '~/tags/tags';

/** Answers `.name` or `!name` with the tag of that name, as Carl-bot answered its tags. */
@ApplyOptions<Listener.Options>({ event: Events.UnknownMessageCommand })
export class TagShortcutListener extends Listener<typeof Events.UnknownMessageCommand> {
	public override async run({ message, commandName }: UnknownMessageCommandPayload) {
		if (!message.inGuild()) return;

		try {
			const found = await findTag(commandName.toLowerCase());

			if (!found) return;

			// A tag may mention users by id, as Carl-bot's did, without pinging them.
			await message.reply({ content: found.content, allowedMentions: { parse: [] } });
		} catch (error) {
			this.container.logger.error(`Failed to answer tag ${commandName}:`, error);
		}
	}
}
