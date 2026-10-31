import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import type { FluxGuildMember, FluxMessage } from '@unbound-app/api/flux';
import { flux, patcher } from '@unbound-app/api';

import { ChannelStore, GuildMemberStore, MessageRowData } from '~/modules';
import { formatRemaining } from '~/format-remaining';

type Member = FluxGuildMember & {
	communicationDisabledUntil?: string | null;
};

type Row = {
	timestamp?: string;
	timestampAccessibilityLabel?: string;
};

function getDeadline({ channel_id, author }: FluxMessage): number | null {
	const guildId = channel_id ? ChannelStore.getChannel(channel_id)?.guild_id : undefined;

	if (!guildId || !author?.id) return null;

	const member: Member | null = GuildMemberStore.getMember(guildId, author.id);

	return getTimeoutDeadline(member?.communicationDisabledUntil);
}

/**
 * @description Appends the time left on the author's timeout to the timestamp of their messages.
 * @returns A function that removes the patch and stops refreshing the countdown.
 */
export function patchTimeoutDurations(): () => void {
	const timedOut = new Map<string, FluxMessage>();

	const unpatch = patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: FluxMessage | undefined = args[0]?.message;

		if (!message?.id) return;

		const deadline = getDeadline(message);

		if (!deadline) {
			timedOut.delete(message.id);

			return;
		}

		timedOut.set(message.id, message);

		const row: Row | undefined = result?.message;

		if (typeof row?.timestamp !== 'string' || row.timestamp.includes('timeout remaining'))
			return;

		const remaining = formatRemaining(deadline);

		row.timestamp = `${row.timestamp} • ${remaining} timeout remaining`;

		if (typeof row.timestampAccessibilityLabel === 'string') {
			row.timestampAccessibilityLabel = `${row.timestampAccessibilityLabel} • Timeout expires in ${remaining}`;
		}
	});

	// Rows are only regenerated on an update, so re-dispatch each timed-out message to tick its countdown.
	const refresh = setInterval(() => {
		for (const message of timedOut.values()) {
			void flux.dispatch({
				type: 'MESSAGE_UPDATE',
				message: { ...message },
				log_edit: false,
			});
		}
	}, 30_000);

	return () => {
		clearInterval(refresh);
		unpatch();
		timedOut.clear();
	};
}
