import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { GuildMember } from 'discord.js';

import { COLOURS } from '~/lib/constants';
import { ordinal } from '~/lib/log-post';
import { stamp } from '~/lib/mod-case';

/** Logs a join with the member's place and account age, as Carl-bot did; needs the members intent. */
@ApplyOptions<Listener.Options>({ event: Events.GuildMemberAdd })
export class LogMemberAddListener extends Listener<typeof Events.GuildMemberAdd> {
	public override async run(member: GuildMember) {
		const { serverLog, config } = this.container;

		if (!serverLog || member.guild.id !== config.guildId) return;

		await serverLog.post({
			kind: 'joins',
			title: 'Member joined',
			colour: COLOURS.positive,
			user: { id: member.id, name: member.user.username },
			lines: [
				`${ordinal(member.guild.memberCount)} to join`,
				`Account created ${stamp(member.user.createdAt, 'R')}`,
			],
		});
	}
}
