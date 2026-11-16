import type { GuildMember, PartialGuildMember } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { COLOURS } from '~/lib/constants';
import { stamp } from '~/lib/mod-case';

/** Logs a leave with when the member joined and their roles, as Carl-bot did; needs the members intent. */
@ApplyOptions<Listener.Options>({ event: Events.GuildMemberRemove })
export class LogMemberRemoveListener extends Listener<typeof Events.GuildMemberRemove> {
	public override async run(member: GuildMember | PartialGuildMember) {
		const { serverLog, config } = this.container;

		if (!serverLog || member.guild.id !== config.guildId) return;

		// A member the bot never cached arrives without their join time or roles.
		const roles = member.roles.cache
			.filter((role) => role.id !== member.guild.id)
			.map((role) => `<@&${role.id}>`);

		await serverLog.post({
			kind: 'joins',
			title: 'Member Left',
			colour: COLOURS.warning,
			user: { id: member.id, name: member.user.username },
			lines: [
				member.joinedAt ? `Joined ${stamp(member.joinedAt, 'R')}` : '',
				roles.length ? `**Roles:** ${roles.join(' ')}` : '',
			],
		});
	}
}
