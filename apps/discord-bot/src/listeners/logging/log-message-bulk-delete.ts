import type { GuildTextBasedChannel, Message, PartialMessage, Snowflake } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { COLOURS } from '~/lib/constants';

/** Logs a purge as one post, with how many messages went. */
@ApplyOptions<Listener.Options>({ event: Events.MessageBulkDelete })
export class LogMessageBulkDeleteListener extends Listener<typeof Events.MessageBulkDelete> {
	public override async run(
		messages: ReadonlyMap<Snowflake, Message<true> | PartialMessage<true>>,
		channel: GuildTextBasedChannel,
	) {
		const { serverLog, config } = this.container;

		if (!serverLog || channel.guildId !== config.guildId) return;

		if (serverLog.isLogChannel(channel.id)) return;

		await serverLog.post({
			kind: 'messages',
			title: 'Messages Purged',
			colour: COLOURS.danger,
			lines: [`**${messages.size}** messages in <#${channel.id}>`],
			footer: channel.id,
		});
	}
}
