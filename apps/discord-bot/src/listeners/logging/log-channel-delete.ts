import { escapeMarkdown, type DMChannel, type NonThreadGuildBasedChannel } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { channelKind } from '~/logging/snapshots';
import { COLOURS } from '~/lib/constants';

/** Logs a deleted channel, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.ChannelDelete })
export class LogChannelDeleteListener extends Listener<typeof Events.ChannelDelete> {
	public override async run(channel: DMChannel | NonThreadGuildBasedChannel) {
		const { serverLog, config } = this.container;

		if (!serverLog || channel.isDMBased() || channel.guildId !== config.guildId) return;

		await serverLog.post({
			kind: 'misc',
			title: `${channelKind(channel)} deleted`,
			colour: COLOURS.danger,
			lines: [
				`**${escapeMarkdown(channel.name)}**${channel.parent ? ` in ${escapeMarkdown(channel.parent.name)}` : ''}`,
			],
			footer: channel.id,
		});
	}
}
