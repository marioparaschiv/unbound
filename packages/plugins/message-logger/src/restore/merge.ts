import type { Entry } from '~/archive/core';

export type HistoryAction = {
	type?: string;
	channelId?: string;
	messages?: any[];
	isBefore?: boolean;
	isAfter?: boolean;
	hasMoreBefore?: boolean;
	hasMoreAfter?: boolean;
	before?: string;
	after?: string;
	around?: string;
};
export function compareIds(a: string, b: string): number {
	return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}
function isId(id: unknown): id is string {
	return typeof id === 'string' && /^\d{1,24}$/.test(id);
}
export function archivedMessage(entry: Entry): Record<string, any> {
	const decoded = Math.floor(Number(entry.messageId) / 4194304) + 1420070400000;
	const time =
		Number.isFinite(decoded) && decoded <= 8640000000000000 ? decoded : entry.capturedAt;
	const filenames = entry.before.attachments.length
		? `\n[Archived file names: ${entry.before.attachments.join(', ')}]`
		: '';
	return {
		id: entry.messageId,
		channel_id: entry.channelId,
		guild_id: entry.guildId || undefined,
		content: entry.before.content + filenames,
		type: 0,
		state: 'SENT',
		timestamp: new Date(time).toISOString(),
		edited_timestamp: null,
		author: {
			id: entry.before.authorId,
			username: entry.before.authorName,
			global_name: entry.before.authorName,
			discriminator: '0',
			avatar: null,
			bot: entry.before.authorBot ?? false,
		},
		attachments: [],
		embeds: [],
		reactions: [],
		components: [],
		mentions: [],
		mention_roles: [],
		mention_everyone: false,
		pinned: false,
		tts: false,
		flags: 0,
	};
}
export type MergedHistory = { messages: any[]; restored: Entry[]; supported: boolean };
/** Merge into a real history response. Never create a gateway MESSAGE_CREATE or overwrite live data. */
export function mergeHistory(
	action: HistoryAction,
	entries: readonly Entry[],
	prepare: (raw: any, sample: any) => any,
): MergedHistory {
	const original = action.messages;
	if (
		!isId(action.channelId) ||
		!Array.isArray(original) ||
		original.some(
			(m) => !m || !isId(m.id) || (m.channel_id && m.channel_id !== action.channelId),
		)
	) {
		return { messages: original ?? [], restored: [], supported: false };
	}
	if (
		!original.length &&
		(action.isBefore !== false || action.isAfter !== false || action.hasMoreBefore !== false)
	) {
		return { messages: original, restored: [], supported: false };
	}
	const ordered = original.map((m) => m.id as string).sort(compareIds);
	const oldest = ordered[0];
	const newest = ordered.at(-1);
	const ids = new Set(original.map((m) => m.id));
	const selected = new Map<string, Entry>();
	for (const e of entries) {
		if (
			e.kind !== 'deleted' ||
			e.channelId !== action.channelId ||
			ids.has(e.messageId) ||
			!isId(e.messageId)
		)
			continue;
		// Respect the fetched window and pagination boundaries. Recent-page loads may include newer deletions.
		if (oldest && compareIds(e.messageId, oldest) < 0 && action.hasMoreBefore !== false)
			continue;
		const latestPage =
			action.isBefore === false &&
			action.isAfter === false &&
			!action.before &&
			!action.after &&
			!action.around;
		if (newest && compareIds(e.messageId, newest) > 0 && !latestPage) continue;
		const previous = selected.get(e.messageId);
		if (!previous || previous.capturedAt < e.capturedAt) selected.set(e.messageId, e);
	}
	const added: any[] = [];
	const restored: Entry[] = [];
	try {
		for (const e of selected.values()) {
			const record = prepare(archivedMessage(e), original[0]);
			if (!record || record.id !== e.messageId)
				return { messages: original, restored: [], supported: false };
			added.push(record);
			restored.push(e);
		}
	} catch {
		return { messages: original, restored: [], supported: false };
	}
	if (!added.length) return { messages: original, restored: [], supported: true };
	const ascending = original.length > 1 && compareIds(original[0].id, original.at(-1)!.id) < 0;
	const direction = ascending ? 1 : -1;
	const messages = [...original, ...added].sort((a, b) => direction * compareIds(a.id, b.id));
	return { messages, restored, supported: true };
}
