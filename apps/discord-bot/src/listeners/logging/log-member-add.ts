import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { GuildMember } from 'discord.js';

import type { InviteUse } from '~/lib/invite-uses';
import { field, person } from '~/lib/post-fields';
import { COLOURS } from '~/lib/constants';
import { ordinal } from '~/lib/log-post';
import { stamp } from '~/lib/mod-case';

function describeInvite({ code, uses, inviterId, vanity }: InviteUse) {
	const by = vanity ? 'vanity url' : inviterId ? `by ${person(inviterId)}` : '';

	return [`\`${code}\``, by, `${uses.toLocaleString('en-US')} uses`].filter(Boolean).join(' · ');
}

/** Logs a join with the member's place, account age and the invite they used; needs the members intent. */
@ApplyOptions<Listener.Options>({ event: Events.GuildMemberAdd })
export class LogMemberAddListener extends Listener<typeof Events.GuildMemberAdd> {
	public override async run(member: GuildMember) {
		const { serverLog, inviteTracker, config } = this.container;

		if (!serverLog || member.guild.id !== config.guildId) return;

		const invite = await inviteTracker?.findUsed();

		await serverLog.post({
			kind: 'joins',
			title: 'Member Joined',
			icon: 'memberJoined',
			colour: COLOURS.positive,
			user: { id: member.id, name: member.user.username },
			lines: [
				field('Account Created', stamp(member.user.createdAt, 'R')),
				field('Member Count', `${ordinal(member.guild.memberCount)} to join`),
				field('Invite', invite ? describeInvite(invite) : '*Unknown*'),
			],
		});
	}
}
