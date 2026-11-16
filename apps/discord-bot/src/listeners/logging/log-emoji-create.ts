import { escapeMarkdown, type GuildEmoji } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { COLOURS } from '~/lib/constants';

/** Logs a new emoji, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.GuildEmojiCreate })
export class LogEmojiCreateListener extends Listener<typeof Events.GuildEmojiCreate> {
	public override async run(emoji: GuildEmoji) {
		const { serverLog, config } = this.container;

		if (!serverLog || emoji.guild.id !== config.guildId) return;

		await serverLog.post({
			kind: 'misc',
			title: 'Emoji Created',
			colour: COLOURS.positive,
			lines: [`${emoji.toString()} ${escapeMarkdown(emoji.name ?? '')}`],
			footer: emoji.id,
		});
	}
}
