import { metro, patcher } from '@unbound-app/api';

type Message = {
	author?: { id?: string };
	channel_id?: string;
	id?: string;
};

const REFRESH_INTERVAL = 30_000;
const MARKER = 'timeout remaining';

let unpatch: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let members: {
	getMember?: (
		guildId: string,
		userId: string,
	) => { communicationDisabledUntil?: unknown } | undefined;
} | null = null;
let channels: { getChannel?: (channelId: string) => { guild_id?: string } | undefined } | null =
	null;
let dispatcher: { dispatch?: (event: unknown) => void } | null = null;
const touchedMessages = new Map<string, Message>();

function timeoutDeadline(value: unknown): number | null {
	if (!value) return null;
	const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
	return Number.isFinite(timestamp) && timestamp > Date.now() ? timestamp : null;
}

function formatRemaining(deadline: number): string {
	const totalMinutes = Math.max(1, Math.ceil((deadline - Date.now()) / 60_000));
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;

	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	return `${minutes}m`;
}

function resolveDeadline(message: Message): number | null {
	const guildId = message.channel_id
		? channels?.getChannel?.(message.channel_id)?.guild_id
		: undefined;
	const userId = message.author?.id;
	if (!guildId || !userId) return null;
	return timeoutDeadline(members?.getMember?.(guildId, userId)?.communicationDisabledUntil);
}

function refreshMessages(): void {
	for (const message of touchedMessages.values()) {
		dispatcher?.dispatch?.({
			type: 'MESSAGE_UPDATE',
			message: { ...message },
			log_edit: false,
		});
	}
}

function addTimeoutDuration(row: any, message: Message | undefined): void {
	if (!message?.id) return;
	const deadline = resolveDeadline(message);
	if (!deadline) {
		touchedMessages.delete(message.id);
		return;
	}

	touchedMessages.set(message.id, message);
	if (typeof row?.timestamp !== 'string' || row.timestamp.includes(MARKER)) return;

	const duration = formatRemaining(deadline);
	row.timestamp = `${row.timestamp} • ${duration} ${MARKER}`;
	if (typeof row.timestampAccessibilityLabel === 'string') {
		row.timestampAccessibilityLabel = `${row.timestampAccessibilityLabel} • Timeout expires in ${duration}`;
	}
}

export default {
	start() {
		members = metro.findStore('GuildMember');
		channels = metro.findByProps('getChannel');
		dispatcher = metro.findByProps('dispatch', 'subscribe');
		const target = metro.findByProps('generateMessageRowData');
		if (!members || !channels || !target?.generateMessageRowData) return;

		unpatch = patcher.after(target, 'generateMessageRowData', (ctx) => {
			try {
				addTimeoutDuration(ctx.result?.message, ctx.args[0]?.message);
			} catch {}
		});
		refreshTimer = setInterval(refreshMessages, REFRESH_INTERVAL);
	},
	stop() {
		unpatch?.();
		unpatch = null;
		if (refreshTimer) clearInterval(refreshTimer);
		refreshTimer = null;
		members = null;
		channels = null;
		dispatcher = null;
		touchedMessages.clear();
	},
};
