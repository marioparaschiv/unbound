import type { SavedHit } from '~/lib/saved-hits';

const CDN = 'https://cdn.discordapp.com';
const DEFAULT_AVATAR_COUNT = 6n;

export type MessageAuthor = { id: string; avatar?: string | null };

export type ItemDetails = {
	body: string;
	guildId: string | null | undefined;
	acked: boolean;
};

export type KeywordNotificationItem = {
	id: string;
	bundle_id: string;
	type: 'recent_mention';
	body: string;
	acked: boolean;
	deeplink: string;
	icon_url: string | null;
	other_user: MessageAuthor | null;
	message: SavedHit;
	item_enum: null;
	completed: false;
	guild_id: string | null;
	icon_name: null;
	message_id: string;
	message_channel_id: string;
	guild_scheduled_event_id: null;
	disable_action: false;
	callout: null;
	application: null;
	emoji_id: null;
	emoji_name: null;
	message_content: string;
	message_embed_count: number;
	message_attachment_count: number;
	message_sticker_count: number;
	is_voice_message: false;
};

type CountedMessage = SavedHit & {
	content?: string;
	author?: MessageAuthor;
	attachments?: unknown[];
	embeds?: unknown[];
	sticker_items?: unknown[];
};

/**
 * @description The avatar picture of a message author, or Discord's default avatar for them.
 * @param author The author's id and avatar hash.
 * @returns The picture's address.
 */
export function avatarUrlOf({ id, avatar }: MessageAuthor): string {
	if (avatar) return `${CDN}/avatars/${id}/${avatar}.png`;

	return `${CDN}/embed/avatars/${Number((BigInt(id) >> 22n) % DEFAULT_AVATAR_COUNT)}.png`;
}

/**
 * @description Builds a notification center item for a keyword hit, in the shape Discord's server sends recent
 * mentions, so the bell lists and opens it like a ping.
 * @param message The message that matched a keyword.
 * @param details The item's text, the message's server and whether it counts as read.
 * @returns The item.
 */
export function keywordNotificationItem(
	message: CountedMessage,
	{ body, guildId, acked }: ItemDetails,
): KeywordNotificationItem {
	const author = message.author;

	return {
		id: message.id,
		bundle_id: `unbound-keyword-${message.id}`,
		type: 'recent_mention',
		body,
		acked,
		deeplink: `https://discord.com/channels/${guildId ?? '@me'}/${message.channel_id}/${message.id}`,
		icon_url: author ? avatarUrlOf(author) : null,
		other_user: author ?? null,
		message,
		item_enum: null,
		completed: false,
		guild_id: guildId ?? null,
		icon_name: null,
		message_id: message.id,
		message_channel_id: message.channel_id,
		guild_scheduled_event_id: null,
		disable_action: false,
		callout: null,
		application: null,
		emoji_id: null,
		emoji_name: null,
		message_content: message.content ?? '',
		message_embed_count: message.embeds?.length ?? 0,
		message_attachment_count: message.attachments?.length ?? 0,
		message_sticker_count: message.sticker_items?.length ?? 0,
		is_voice_message: false,
	};
}

export default { avatarUrlOf, keywordNotificationItem };
