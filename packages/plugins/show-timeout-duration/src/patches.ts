import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import {
	MessageRowData,
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import type { FluxGuildMember, FluxMessage } from '@unbound-app/api/flux';
import { format } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { formatRemaining } from '~/lib/format-remaining';

type Member = FluxGuildMember & {
	communicationDisabledUntil?: string | null;
};

const ChannelStore = flux.getStore('Channel');
const GuildMemberStore = flux.getStore('GuildMember');

function getDeadline({ channel_id, author }: FluxMessage): number | null {
	const guildId = channel_id ? ChannelStore.getChannel(channel_id)?.guild_id : undefined;

	if (!guildId || !author?.id) return null;

	const member: Member | null = GuildMemberStore.getMember(guildId, author.id);

	return getTimeoutDeadline(member?.communicationDisabledUntil);
}

/**
 * @description Appends the time left on the author's timeout to the timestamp of their messages, by patching
 * `generateMessageRowData` on Discord's message row module. A scoped timer ticks the countdown.
 */
export function patchMessageRows(): void {
	if (!MessageRowData) {
		logger.warn('Timeout duration skipped: Discord moved MessageRowData.');

		return;
	}

	const timedOut = new Map<string, FluxMessage>();
	const stamped = new WeakSet<MessageRow>();

	onMessageRow<RowMessage & FluxMessage>({
		after({ message, row }) {
			if (!message?.id) return;

			const deadline = getDeadline(message);

			if (!deadline) {
				timedOut.delete(message.id);

				return;
			}

			timedOut.set(message.id, message);

			if (typeof row?.timestamp !== 'string' || stamped.has(row)) return;

			stamped.add(row);

			const remaining = formatRemaining(deadline);

			row.timestamp = `${row.timestamp} • ${format('TIMEOUT_REMAINING', { remaining })}`;

			if (typeof row.timestampAccessibilityLabel === 'string') {
				row.timestampAccessibilityLabel = `${row.timestampAccessibilityLabel} • ${format('TIMEOUT_EXPIRES_IN', { remaining })}`;
			}
		},
	});

	// Rows are only regenerated on an update, so re-dispatch each timed-out message to tick its countdown.
	setInterval(() => {
		for (const message of timedOut.values()) {
			void flux.dispatch({
				type: 'MESSAGE_UPDATE',
				message: { ...message },
				log_edit: false,
			});
		}
	}, 30_000);
}
