import { escapeMarkdown, type GuildEmoji } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { COLOURS } from '~/lib/constants';

/** Logs a deleted emoji, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.GuildEmojiDelete })
export class LogEmojiDeleteListener extends Listener<typeof Events.GuildEmojiDelete> {
	public override async run(emoji: GuildEmoji) {
		const { serverLog, config } = this.container;

		if (!serverLog || emoji.guild.id !== config.guildId) return;

		await serverLog.post({
			kind: 'misc',
			title: 'Emoji Deleted',
			colour: COLOURS.danger,
			lines: [`**${escapeMarkdown(emoji.name ?? emoji.id)}**`],
			footer: emoji.id,
		});
	}
}
