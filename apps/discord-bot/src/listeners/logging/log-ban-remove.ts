import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { GuildBan } from 'discord.js';

import { COLOURS } from '~/lib/constants';

/** Logs an unban, whoever took it, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.GuildBanRemove })
export class LogBanRemoveListener extends Listener<typeof Events.GuildBanRemove> {
	public override async run({ guild, user }: GuildBan) {
		const { serverLog, config } = this.container;

		if (!serverLog || guild.id !== config.guildId) return;

		await serverLog.post({
			kind: 'moderation',
			title: 'Member unbanned',
			colour: COLOURS.positive,
			user: { id: user.id, name: user.username },
		});
	}
}
