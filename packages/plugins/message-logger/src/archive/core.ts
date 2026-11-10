export type Snapshot = {
	content: string;
	authorId: string;
	authorName: string;
	authorBot?: boolean;
	attachments: string[];
};
export type Entry = {
	accountId: string;
	channelId: string;
	guildId: string;
	messageId: string;
	kind: 'deleted' | 'edited';
	capturedAt: number;
	before: Snapshot;
	after?: Snapshot;
};
export type Options = {
	enabled: boolean;
	days: number;
	limit: number;
	ignoreBots: boolean;
	ignoreSelf: boolean;
	channels: string;
	ignoredUsers: string;
	ignoredGuilds: string;
};
export const defaults: Options = {
	enabled: false,
	days: 7,
	limit: 500,
	ignoreBots: true,
	ignoreSelf: false,
	channels: '',
	ignoredUsers: '',
	ignoredGuilds: '',
};
export type Archive = { version: 1; generation: number; options: Options; entries: Entry[] };
export const emptyArchive = (): Archive => ({
	version: 1,
	generation: 0,
	options: { ...defaults },
	entries: [],
});
const id = (value: unknown): value is string =>
	typeof value === 'string' && /^\d{1,24}$/.test(value);
const text = (value: unknown, max: number): value is string =>
	typeof value === 'string' && value.length <= max;
export function validOptions(o: any): o is Options {
	return (
		!!o &&
		typeof o.enabled === 'boolean' &&
		typeof o.ignoreBots === 'boolean' &&
		typeof o.ignoreSelf === 'boolean' &&
		Number.isInteger(o.days) &&
		o.days >= 1 &&
		o.days <= 30 &&
		Number.isInteger(o.limit) &&
		o.limit >= 50 &&
		o.limit <= 2000 &&
		['channels', 'ignoredUsers', 'ignoredGuilds'].every((k) => text(o[k], 4000))
	);
}
function validSnapshot(s: any): s is Snapshot {
	return (
		!!s &&
		text(s.content, 16000) &&
		id(s.authorId) &&
		text(s.authorName, 200) &&
		(s.authorBot === undefined || typeof s.authorBot === 'boolean') &&
		Array.isArray(s.attachments) &&
		s.attachments.length <= 20 &&
		s.attachments.every((v: unknown) => text(v, 300))
	);
}
export function parseArchive(raw: string): Archive {
	if (raw.length > 4_000_000) throw new Error('Archive exceeds the safety limit.');
	const a = JSON.parse(raw);
	if (
		a?.version !== 1 ||
		!Number.isSafeInteger(a.generation) ||
		a.generation < 0 ||
		!validOptions(a.options) ||
		!Array.isArray(a.entries) ||
		a.entries.length > 2000 ||
		!a.entries.every(
			(e: any) =>
				e &&
				id(e.accountId) &&
				id(e.channelId) &&
				id(e.messageId) &&
				(e.guildId === '' || id(e.guildId)) &&
				['edited', 'deleted'].includes(e.kind) &&
				Number.isSafeInteger(e.capturedAt) &&
				e.capturedAt > 0 &&
				validSnapshot(e.before) &&
				(e.kind === 'deleted' ? e.after === undefined : validSnapshot(e.after)),
		)
	) {
		throw new Error('Unsupported or damaged archive.');
	}
	return a;
}
export function prune(a: Archive, now = Date.now()): void {
	a.entries = a.entries
		.filter(
			(e) => e.capturedAt > now - a.options.days * 86400000 && e.capturedAt <= now + 60000,
		)
		.sort((x, y) => x.capturedAt - y.capturedAt)
		.slice(-a.options.limit);
	// Bound total UTF-16 content as well as event count (at most ~4 MB UTF-8).
	let size = 0;
	a.entries = a.entries
		.reverse()
		.filter((e) => (size += JSON.stringify(e).length) <= 900000)
		.reverse();
}
export function search(a: Archive, accountId: string, query: string, channel = ''): Entry[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return a.entries
		.filter(
			(e) =>
				e.accountId === accountId &&
				(!channel || e.channelId === channel) &&
				terms.every((t) =>
					[
						e.kind,
						e.channelId,
						e.guildId,
						e.messageId,
						e.before.authorId,
						e.before.authorName,
						e.before.content,
						e.after?.content ?? '',
						...e.before.attachments,
						...(e.after?.attachments ?? []),
					]
						.join(' ')
						.toLowerCase()
						.includes(t),
				),
		)
		.reverse();
}
export const ids = (value: string): Set<string> => new Set(value.split(/[\s,]+/).filter(Boolean));

export function snapshot(message: any): Snapshot | undefined {
	if (!id(message?.author?.id) || typeof message.content !== 'string') return;
	return {
		content: message.content.slice(0, 16000),
		authorId: message.author.id,
		authorBot: !!message.author.bot,
		authorName: String(
			message.author.globalName ??
				message.author.global_name ??
				message.author.username ??
				message.author.id,
		).slice(0, 200),
		// Names only: no attachment URLs, downloads, tokens, embeds or full Discord objects.
		attachments: Array.isArray(message.attachments)
			? message.attachments
					.slice(0, 20)
					.map((a: any) => String(a.filename ?? a.name ?? 'Attachment').slice(0, 300))
			: [],
	};
}
export function capture(
	a: Archive,
	accountId: string,
	kind: Entry['kind'],
	previous: any,
	next: any,
	channel: any,
	now = Date.now(),
): boolean {
	const o = a.options;
	const before = snapshot(previous);
	const channelId = previous?.channel_id;
	if (
		!o.enabled ||
		!id(accountId) ||
		!before ||
		!id(channelId) ||
		!id(previous.id) ||
		(Number(previous.flags ?? 0) & 64) !== 0 ||
		(o.ignoreBots && previous.author.bot) ||
		(o.ignoreSelf && before.authorId === accountId) ||
		ids(o.ignoredUsers).has(before.authorId) ||
		ids(o.ignoredGuilds).has(channel?.guild_id) ||
		(ids(o.channels).size > 0 && !ids(o.channels).has(channelId))
	)
		return false;
	const after =
		kind === 'edited' ? snapshot({ ...previous, ...next, author: previous.author }) : undefined;
	if (
		kind === 'edited' &&
		(!after ||
			(before.content === after.content &&
				JSON.stringify(before.attachments) === JSON.stringify(after.attachments)))
	)
		return false;
	const entry: Entry = {
		accountId,
		channelId,
		guildId: channel?.guild_id ?? '',
		messageId: previous.id,
		kind,
		capturedAt: now,
		before,
		...(after ? { after } : {}),
	};
	const last = a.entries.at(-1);
	if (
		last &&
		last.accountId === accountId &&
		last.messageId === entry.messageId &&
		last.kind === kind &&
		JSON.stringify(last.before) === JSON.stringify(before) &&
		JSON.stringify(last.after) === JSON.stringify(after)
	)
		return false;
	a.entries.push(entry);
	prune(a, now);
	return true;
}
