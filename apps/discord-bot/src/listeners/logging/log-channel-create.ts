import { escapeMarkdown, type NonThreadGuildBasedChannel } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { channelKind } from '~/logging/snapshots';
import { COLOURS } from '~/lib/constants';

/** Logs a new channel, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.ChannelCreate })
export class LogChannelCreateListener extends Listener<typeof Events.ChannelCreate> {
	public override async run(channel: NonThreadGuildBasedChannel) {
		const { serverLog, config } = this.container;

		if (!serverLog || channel.guildId !== config.guildId) return;

		await serverLog.post({
			kind: 'misc',
			title: `${channelKind(channel)} created`,
			colour: COLOURS.positive,
			lines: [
				`<#${channel.id}>${channel.parent ? ` in ${escapeMarkdown(channel.parent.name)}` : ''}`,
			],
			footer: channel.id,
		});
	}
}
