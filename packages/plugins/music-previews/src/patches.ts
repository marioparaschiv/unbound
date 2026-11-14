import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { flux } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { pickClip, type Clip } from '~/lib/clips';
import { playInEmbed, type RowEmbed } from '~/lib/embed-audio';
import { loadCollection } from '~/lib/load-collection';
import { parseMusicLink } from '~/lib/music-link';

type EmbedRow = MessageRow & { embeds?: RowEmbed[] };

type StoredMessage = { content: string; author: unknown };

const MessageStore = flux.getStore('Message') as unknown as {
	getMessage?: (channelId: string, messageId: string) => StoredMessage | undefined;
};

const clips = new Map<string, Clip | null>();
const loading = new Map<string, Set<string>>();

function redraw(channelId: string, messageId: string): void {
	const message = MessageStore.getMessage?.(channelId, messageId);

	if (!message) return;

	void flux.dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: messageId,
			channel_id: channelId,
			content: message.content,
			author: message.author,
		},
	} as Parameters<typeof flux.dispatch>[0]);
}

function load(url: string, channelId: string, messageId: string): void {
	const waiting = loading.get(url);
	const key = `${channelId}:${messageId}`;

	if (waiting) {
		waiting.add(key);

		return;
	}

	const link = parseMusicLink(url);

	if (!link) return;

	loading.set(url, new Set([key]));
	loadCollection(link)
		.then((collection) => (collection ? pickClip(collection) : undefined))
		.catch((error: unknown) => {
			logger.error(`Failed to load music preview ${url}:`, error);
		})
		.then((clip) => {
			clips.set(url, clip ?? null);

			const keys = loading.get(url) ?? new Set<string>();

			loading.delete(url);

			if (!clip) return;

			for (const each of keys) {
				const [channel, message] = each.split(':');

				if (channel && message) redraw(channel, message);
			}
		});
}

/**
 * @description Plays Spotify and Apple Music previews inside their link embeds, like desktop. Hooks Discord's chat row
 * builder and turns each music embed into an audio embed holding its preview clip, which Discord draws with its native
 * audio player; clips not loaded yet are fetched and the message's row is built again.
 */
export function patchMusicEmbeds(): void {
	onMessageRow<RowMessage, EmbedRow>({
		feature: 'Music previews',
		after: ({ message, row }) => {
			for (const embed of row?.embeds ?? []) {
				const url = embed.url;

				if (!url || !parseMusicLink(url)) continue;

				const clip = clips.get(url);

				if (clip) playInEmbed(embed, clip, messages.PREVIEW);
				else if (clip === undefined && message?.channel_id && message.id) {
					load(url, message.channel_id, message.id);
				}
			}
		},
	});
}

/**
 * @description Forgets the loaded clips.
 */
export function clearClips(): void {
	clips.clear();
	loading.clear();
}
