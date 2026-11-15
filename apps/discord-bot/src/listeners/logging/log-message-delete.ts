import type { Message, PartialMessage } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { quoteContent } from '~/lib/log-changes';
import { COLOURS } from '~/lib/constants';

/** Logs a deleted message's text and attachments, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.MessageDelete })
export class LogMessageDeleteListener extends Listener<typeof Events.MessageDelete> {
	public override async run(message: Message | PartialMessage) {
		const { serverLog, config } = this.container;

		if (!serverLog || message.guildId !== config.guildId) return;

		if (serverLog.isLogChannel(message.channelId)) return;

		const { author } = message;

		// A message sent before the bot started is unknown beyond its id; Carl-bot logged none either.
		if (!author || author.bot || message.webhookId) return;

		const files = [...message.attachments.values()].map(({ name, url }) => `[${name}](${url})`);

		await serverLog.post({
			kind: 'messages',
			title: 'Message deleted',
			colour: COLOURS.danger,
			user: { id: author.id, name: author.username },
			lines: [
				`in <#${message.channelId}>`,
				quoteContent(message.content),
				files.length ? `**Attachments:** ${files.join(', ')}` : undefined,
				`-# Message ID: ${message.id}`,
			].filter((line) => line !== undefined),
		});
	}
}
