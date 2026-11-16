import { format } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import {
	forgetHit,
	hitsForPage,
	newestFirst,
	rememberHit,
	type PageOptions,
	type SavedHit,
} from '~/lib/saved-hits';
import { keywordNotificationItem, type MessageAuthor } from '~/lib/notification-item';
import { isIgnored } from '~/lib/ignored';
import { getSavedHits, saveHits } from '~/lib/hit-store';

const SAVED_HIT_LIMIT = 100;

type RecentMentionsStore = { getMentions(): { id: string }[] | null | undefined };

type NotificationItemsStore = { items: { id: string }[] };

type GuildStore = { getGuild(id: string): { name?: string } | undefined };

type NamedChannelStore = {
	getChannel(
		id: string,
	): { guild_id?: string | null; parent_id?: string | null; name?: string } | undefined;
};

type AuthoredHit = SavedHit & {
	author?: MessageAuthor & { username?: string; global_name?: string | null };
};

type Stores = { Channels: NamedChannelStore; Guilds: GuildStore };

let inboxGuildId: string | null = null;

function isHit(message: unknown): message is AuthoredHit {
	const entry = message as Partial<SavedHit> | null;

	return typeof entry?.id === 'string' && typeof entry.channel_id === 'string';
}

function stores(): Stores {
	return {
		Channels: flux.getStore('Channel') as unknown as NamedChannelStore,
		Guilds: flux.getStore('Guild') as unknown as GuildStore,
	};
}

function pageOptions({ Channels }: Stores, listOldestId: string | undefined): PageOptions {
	return {
		guildOf: (channelId) => Channels.getChannel(channelId)?.guild_id,
		listOldestId,
		isIgnored: (message) => isIgnored(Channels, message),
	};
}

function notificationItem({ Channels, Guilds }: Stores, hit: AuthoredHit, acked: boolean) {
	const channel = Channels.getChannel(hit.channel_id);
	const guildId = channel?.guild_id;
	const author = hit.author?.global_name ?? hit.author?.username ?? '';
	const body = guildId
		? format('KEYWORD_IN_SERVER', {
				author,
				server: Guilds.getGuild(guildId)?.name ?? '',
				channel: channel?.name ?? '',
			})
		: format('KEYWORD_IN_DM', { author });

	return keywordNotificationItem(hit, { body, guildId, acked });
}

function isOlderThanAll(ids: string[], listed: { id: string }[]): boolean {
	const newest = ids[0];
	const oldest = listed.at(-1)?.id;

	return Boolean(newest && oldest && BigInt(newest) < BigInt(oldest));
}

function forget(messageId: unknown) {
	if (typeof messageId !== 'string') return;

	const hits = getSavedHits();
	const kept = forgetHit(hits, messageId);

	if (kept.length !== hits.length) saveHits(kept);
}

/**
 * @description Saves a new keyword hit and adds it to the bell's notifications as unread, so the inbox keeps it after
 * Discord reloads its lists from the server, which knows nothing about keywords.
 * @param message The message, already marked as mentioning the current user.
 */
export function rememberInboxHit(message: unknown): void {
	if (!isHit(message)) return;

	const copy: unknown = JSON.parse(JSON.stringify(message));

	if (!isHit(copy)) return;

	saveHits(rememberHit(getSavedHits(), copy, SAVED_HIT_LIMIT));
	setTimeout(() =>
		flux.dispatch({
			type: 'NOTIFICATION_CENTER_ITEM_CREATE',
			item: notificationItem(stores(), copy, false),
		}),
	);
}

/**
 * @description Merges saved keyword hits into each page Discord loads for the bell's notifications and for recent
 * mentions, following the server filter and the ignore lists, and forgets a hit once it is removed or deleted.
 */
export function interceptInbox(): void {
	const Items = flux.getStore('NotificationCenterItems') as unknown as NotificationItemsStore;
	const Mentions = flux.getStore('RecentMentions') as unknown as RecentMentionsStore;

	flux.interceptAction('LOAD_NOTIFICATION_CENTER_ITEMS_SUCCESS', (action) => {
		const page = action as { items?: { id: string }[]; hasMore?: boolean };
		const hits = getSavedHits();

		if (!hits.length || !Array.isArray(page.items)) return false;

		const ids = page.items.map((item) => item.id);
		const isAfter = isOlderThanAll(ids, Items.items);
		const current = stores();
		const fitting = hitsForPage(
			{ ids, isAfter, hasMore: Boolean(page.hasMore) },
			hits,
			pageOptions(current, Items.items.at(-1)?.id),
		);

		page.items = [
			...page.items,
			...fitting.map((hit) => notificationItem(current, hit, true)),
		].sort(newestFirst);

		return false;
	});

	flux.interceptAction('LOAD_RECENT_MENTIONS', (action) => {
		inboxGuildId = (action as { guildId?: string | null }).guildId ?? null;

		return false;
	});

	flux.interceptAction('LOAD_RECENT_MENTIONS_SUCCESS', (action) => {
		const page = action as { messages?: SavedHit[]; isAfter?: boolean; hasMoreAfter?: boolean };
		const hits = getSavedHits();

		if (!hits.length || !Array.isArray(page.messages)) return false;

		const fitting = hitsForPage(
			{
				ids: page.messages.map((message) => message.id),
				isAfter: Boolean(page.isAfter),
				hasMore: Boolean(page.hasMoreAfter),
			},
			hits,
			{ ...pageOptions(stores(), Mentions.getMentions()?.at(-1)?.id), guildId: inboxGuildId },
		);

		page.messages = [...page.messages, ...fitting].sort(newestFirst);

		return false;
	});

	for (const type of [
		'NOTIFICATION_CENTER_ITEM_DELETE',
		'RECENT_MENTION_DELETE',
		'MESSAGE_DELETE',
	]) {
		flux.interceptAction(type, (action) => {
			forget((action as { id?: unknown }).id);

			return false;
		});
	}
}

export default { interceptInbox, rememberInboxHit };
