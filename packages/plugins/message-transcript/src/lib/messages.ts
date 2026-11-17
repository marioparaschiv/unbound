import { flux } from '@unbound-app/api';

import type { TranscriptMessage } from '~/lib/transcript';

type StoredMessage = {
	id: string;
	content?: string;
	timestamp?: string | number | Date;
	author?: { id: string; username?: string; globalName?: string | null };
	attachments?: { url?: string; filename?: string }[];
	guild_id?: string;
};

type MessageList = { toArray(): StoredMessage[] };

type MessageStore = { getMessages(channelId: string): MessageList | undefined };

type MemberStore = { getNick?(guildId: string, userId: string): string | null | undefined };

function authorName(message: StoredMessage, guildId: string | undefined): string {
	const { author } = message;

	if (!author) return '?';

	const Members = flux.getStore('GuildMember') as unknown as MemberStore;
	const nick = guildId ? Members.getNick?.(guildId, author.id) : undefined;

	return nick || author.globalName || author.username || author.id;
}

/**
 * @description Reads the messages Discord has loaded for a channel, oldest first, as transcript lines need them.
 * @param channelId The channel.
 * @returns The messages.
 */
export function loadedMessages(channelId: string): TranscriptMessage[] {
	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const guildId = flux.getStore('Channel').getChannel(channelId)?.guild_id ?? undefined;

	return (Messages.getMessages(channelId)?.toArray() ?? []).map((message) => ({
		id: message.id,
		author: authorName(message, guildId),
		timestamp: message.timestamp ?? 0,
		content: message.content ?? '',
		attachments: (message.attachments ?? []).flatMap(({ url }) => (url ? [url] : [])),
	}));
}
