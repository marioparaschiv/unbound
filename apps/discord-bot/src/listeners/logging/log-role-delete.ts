import { Events, Listener } from '@sapphire/framework';
import { escapeMarkdown, type Role } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

import { COLOURS } from '~/lib/constants';

/** Logs a deleted role, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.GuildRoleDelete })
export class LogRoleDeleteListener extends Listener<typeof Events.GuildRoleDelete> {
	public override async run(role: Role) {
		const { serverLog, config } = this.container;

		if (!serverLog || role.guild.id !== config.guildId) return;

		await serverLog.post({
			kind: 'misc',
			title: 'Role Deleted',
			colour: COLOURS.danger,
			lines: [`**${escapeMarkdown(role.name)}**`],
			footer: role.id,
		});
	}
}
