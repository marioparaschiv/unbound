import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { FluxGuildMember } from '@unbound-app/api/flux';
import { patcher } from '@unbound-app/api';

import { ChannelStore, GuildMemberStore, MessageRowData } from '~/modules';

type Message = {
	guild_id?: string;
	guildId?: string;
	channel_id?: string;
	channelId?: string;
	author?: { id?: string };
	authorId?: string;
};

type Member = FluxGuildMember & {
	communicationDisabledUntil?: string | null;
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

	return patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const row: Row | undefined = result?.message;
		const message: Message | undefined = args[0]?.message;

		if (!row || !message) return;

		const channelId = message.channel_id ?? message.channelId;
		const guildId =
			message.guild_id ??
			message.guildId ??
			(channelId ? ChannelStore.getChannel(channelId)?.guild_id : undefined);
		const userId = message.author?.id ?? message.authorId ?? row.authorId;

		if (!guildId || !userId) return;

		const member: Member | null = GuildMemberStore.getMember(guildId, userId);

		if (getTimeoutDeadline(member?.communicationDisabledUntil))
			row.communicationDisabled = true;
	});
}
