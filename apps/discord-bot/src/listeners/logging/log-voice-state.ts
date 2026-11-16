import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceState } from 'discord.js';

import { COLOURS } from '~/lib/constants';

function describe(before: string | null, after: string | null) {
	if (!before && after) {
		return {
			title: 'Joined Voice Channel',
			line: `joined <#${after}>`,
			colour: COLOURS.positive,
		};
	}

	if (before && !after) {
		return { title: 'Left Voice Channel', line: `left <#${before}>`, colour: COLOURS.danger };
	}

	return {
		title: 'Moved Voice Channel',
		line: `<#${before}> → <#${after}>`,
		colour: COLOURS.info,
	};
}

/** Logs a member joining, leaving or moving between voice channels, as Carl-bot did. */
@ApplyOptions<Listener.Options>({ event: Events.VoiceStateUpdate })
export class LogVoiceStateListener extends Listener<typeof Events.VoiceStateUpdate> {
	public override async run(before: VoiceState, after: VoiceState) {
		const { serverLog, config } = this.container;

		if (!serverLog || after.guild.id !== config.guildId) return;

		// Mutes, deafens and streams change the state without a move.
		if (before.channelId === after.channelId) return;

		const member = after.member ?? before.member;

		if (!member || member.user.bot) return;

		const { title, line, colour } = describe(before.channelId, after.channelId);

		await serverLog.post({
			kind: 'misc',
			title,
			colour,
			user: { id: member.id, name: member.user.username },
			lines: [line],
		});
	}
}
