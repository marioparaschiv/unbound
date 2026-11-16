import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Guild } from 'discord.js';

import { describeChanges } from '~/lib/log-changes';
import { guildSnapshot } from '~/logging/snapshots';
import { COLOURS } from '~/lib/constants';

/** Logs a change to the server's name, icon, banner, description or vanity url, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.GuildUpdate })
export class LogGuildUpdateListener extends Listener<typeof Events.GuildUpdate> {
	public override async run(before: Guild, after: Guild) {
		const { serverLog, config } = this.container;

		if (!serverLog || after.id !== config.guildId) return;

		const lines = describeChanges(guildSnapshot(before), guildSnapshot(after));

		if (!lines.length) return;

		await serverLog.post({
			kind: 'misc',
			title: 'Server Updated',
			colour: COLOURS.info,
			lines,
			footer: after.id,
		});
	}
}
