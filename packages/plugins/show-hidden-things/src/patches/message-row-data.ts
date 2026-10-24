import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChannelStore, GuildMemberStore, MessageRowData, Patcher } from '~/modules';

type Message = {
	guild_id?: string;
	guildId?: string;
	channel_id?: string;
	channelId?: string;
	author?: { id?: string };
	authorId?: string;
};

type Row = {
	authorId?: string;
	communicationDisabled?: boolean;
};

/**
 * @description Shows the timeout icon next to timed-out members in chat.
 * @returns A function that removes the patch.
 */
export function patchTimeoutIcons(): () => void {
	if (
		!ensureModules('Show Hidden Things: timeout icons', {
			MessageRowData,
			GuildMemberStore,
			ChannelStore,
		})
	) {
		return () => {};
	}

	return Patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const row: Row | undefined = result?.message;
		const message: Message | undefined = args[0]?.message;

		if (!row || !message) return;

		const guildId =
			message.guild_id ??
			message.guildId ??
			ChannelStore.getChannel(message.channel_id ?? message.channelId)?.guild_id;
		const userId = message.author?.id ?? message.authorId ?? row.authorId;

		if (!guildId || !userId) return;

		const member = GuildMemberStore.getMember(guildId, userId);

		if (getTimeoutDeadline(member?.communicationDisabledUntil))
			row.communicationDisabled = true;
	});
}
