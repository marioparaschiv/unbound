import type { Message, PartialMessage } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { field, fieldBelow } from '~/lib/post-fields';
import { quoteContent } from '~/lib/log-changes';
import { COLOURS } from '~/lib/constants';

/** Logs an edited message's text before and after, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.MessageUpdate })
export class LogMessageUpdateListener extends Listener<typeof Events.MessageUpdate> {
	public override async run(before: Message | PartialMessage, after: Message | PartialMessage) {
		const { serverLog, config } = this.container;

		if (!serverLog || after.guildId !== config.guildId) return;

		if (serverLog.isLogChannel(after.channelId)) return;

		// An embed resolving updates the message without an edit.
		if (!after.editedTimestamp || before.content === after.content) return;

		const message = after.partial ? await after.fetch().catch(() => undefined) : after;

		if (!message || message.author.bot || message.webhookId) return;

		await serverLog.post({
			kind: 'messages',
			title: 'Message Edited',
			icon: 'messageEdited',
			colour: COLOURS.info,
			user: { id: message.author.id, name: message.author.username },
			lines: [
				field('Channel', `<#${message.channelId}> · [Jump to message](${message.url})`),
				fieldBelow('Before', quoteContent(before.partial ? null : before.content)),
				fieldBelow('After', quoteContent(message.content)),
			],
			footer: message.id,
		});
	}
}
