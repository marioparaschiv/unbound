import getTimeoutDeadline from '@unbound-plugins/shared/members/timeout-deadline';
import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { FluxGuildMember, FluxMessage } from '@unbound-app/api/flux';
import { format } from '@unbound-app/i18n';
import { flux, patcher } from '@unbound-app/api';

import { ChannelStore, GuildMemberStore, MessageRowData } from '~/timeout-remaining/modules';
import { formatRemaining } from '~/timeout-remaining/format-remaining';

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
 * Patches `generateMessageRowData` on Discord's message row module, and reads `GuildMemberStore`
 * and `ChannelStore`. The Addon scope removes the patch and the refresh timer when the plugin stops.
 */
export function startTimeoutRemaining(): void {
	if (
		!ensureModules('Show Timeout Duration', { MessageRowData, GuildMemberStore, ChannelStore })
	) {
		return;
	}

	const timedOut = new Map<string, FluxMessage>();
	const stamped = new WeakSet<Row>();

	patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: FluxMessage | undefined = args[0]?.message;

		if (!message?.id) return;

		const deadline = getDeadline(message);

		if (!deadline) {
			timedOut.delete(message.id);

			return;
		}

		timedOut.set(message.id, message);

		const row: Row | undefined = result?.message;

		if (typeof row?.timestamp !== 'string' || stamped.has(row)) return;

		stamped.add(row);

		const remaining = formatRemaining(deadline);

		row.timestamp = `${row.timestamp} • ${format('TIMEOUT_REMAINING', { remaining })}`;

		if (typeof row.timestampAccessibilityLabel === 'string') {
			row.timestampAccessibilityLabel = `${row.timestampAccessibilityLabel} • ${format('TIMEOUT_EXPIRES_IN', { remaining })}`;
		}
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

	recordApplied(1);
}
