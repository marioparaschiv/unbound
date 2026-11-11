import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import {
	MessageRowData,
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import type { FluxGuildMember } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

type Message = RowMessage & {
	guild_id?: string;
	guildId?: string;
	channelId?: string;
	authorId?: string;
};

type Member = FluxGuildMember & {
	communicationDisabledUntil?: string | null;
};

type Row = MessageRow & {
	communicationDisabled?: boolean;
};

/**
 * @description Shows the timeout icon next to timed-out members in chat.
 * Patches `generateMessageRowData` on Discord's message row module, reads members from `GuildMemberStore` and
 * channels from `ChannelStore`, and does nothing while `showTimeouts` is off.
 */
export function patchMessageRows(): void {
	if (!MessageRowData) {
		logger.warn('Timeout icons skipped: Discord moved MessageRowData.');

		return;
	}

	const GuildMemberStore = flux.getStore('GuildMember');
	const ChannelStore = flux.getStore('Channel');

	onMessageRow<Message, Row>({
		after({ message, row }) {
			if (!settings.showTimeouts || !row || !message) return;

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
		},
	});
}

/**
 * @description Shows the Pause Invites setting in Server Settings to every member, not only to moderators.
 * Patches `useInvitesDisabledPermission` on Discord's invite permissions module, and does nothing while
 * `showInvitesPaused` is off.
 */
export function patchInvitePermissions(): void {
	const InvitePermissions = metro.findByProps('useInvitesDisabledPermission');

	if (!InvitePermissions) {
		logger.warn('Paused invites skipped: Discord moved InvitePermissions.');

		return;
	}

	patcher.after(InvitePermissions, 'useInvitesDisabledPermission', ({ result }) =>
		settings.showInvitesPaused ? true : result,
	);
}
