import type { DMChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { channelKind, channelSnapshot, overwritesKey } from '~/logging/snapshots';
import { describeChanges } from '~/lib/log-changes';
import { COLOURS } from '~/lib/constants';

/** Logs what changed on a channel, as Carl-bot did; a move in the list alone is not logged. */
@ApplyOptions<Listener.Options>({ event: Events.ChannelUpdate })
export class LogChannelUpdateListener extends Listener<typeof Events.ChannelUpdate> {
	public override async run(
		before: DMChannel | NonThreadGuildBasedChannel,
		after: DMChannel | NonThreadGuildBasedChannel,
	) {
		const { serverLog, config } = this.container;

		if (!serverLog || before.isDMBased() || after.isDMBased()) return;

		if (after.guildId !== config.guildId) return;

		const lines = describeChanges(channelSnapshot(before), channelSnapshot(after));

		if (overwritesKey(before) !== overwritesKey(after)) {
			lines.push('**Permissions:** overwrites changed');
		}

		if (!lines.length) return;

		await serverLog.post({
			kind: 'misc',
			title: `${channelKind(after)} updated`,
			colour: COLOURS.info,
			lines: [`<#${after.id}>`, ...lines],
			footer: after.id,
		});
	}
}
