import { flux } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { embedChannel } from '~/lib/channels';
import { decorateEmbeds, type RawEmbed } from '~/lib/decorate';
import { createStatusCache } from '~/lib/status-cache';
import { readStatus, type StreamStatus } from '~/lib/status';

type RawMessage = { id?: string; channel_id?: string; embeds?: RawEmbed[] };
type MessageAction = { message?: RawMessage };
type MessagesAction = { messages?: RawMessage[] };

const STATUS_URL = 'https://decapi.me/twitch/uptime/';
const KEPT_MESSAGES = 300;

const cache = createStatusCache();
const pending = new Set<string>();
const shown = new Map<string, { channelId: string; embeds: RawEmbed[] }>();
let running = false;

function label(status: StreamStatus): string {
	return status.live ? format('LIVE', { uptime: status.uptime }) : messages.OFFLINE;
}

function twitchChannelsOf(embeds: RawEmbed[]): string[] {
	return [
		...new Set(
			embeds
				.map((embed) => embedChannel(embed.url))
				.filter((channel) => channel !== undefined),
		),
	];
}

function remember(message: RawMessage) {
	if (!message.id || !message.channel_id || !message.embeds) return;

	shown.delete(message.id);
	shown.set(message.id, { channelId: message.channel_id, embeds: message.embeds });

	if (shown.size > KEPT_MESSAGES) shown.delete(shown.keys().next().value!);
}

function refresh(channel: string) {
	for (const [id, { channelId, embeds }] of [...shown]) {
		if (!twitchChannelsOf(embeds).includes(channel)) continue;

		void flux.dispatch({
			type: 'MESSAGE_UPDATE',
			message: {
				id,
				channel_id: channelId,
				embeds: decorateEmbeds(embeds, cache.get, label),
			},
		} as never);
	}
}

async function lookUp(channel: string) {
	pending.add(channel);

	try {
		const response = await fetch(STATUS_URL + encodeURIComponent(channel));
		const status = response.ok ? readStatus(await response.text()) : undefined;

		if (!status || !running) return;

		cache.set(channel, status);
		refresh(channel);
	} catch (error) {
		logger.error(`Failed to look up Twitch channel ${channel}:`, error);
	} finally {
		pending.delete(channel);
	}
}

function decorate(message: RawMessage): RawMessage {
	if (!message.embeds?.length) return message;

	const channels = twitchChannelsOf(message.embeds);

	if (!channels.length) return message;

	remember(message);

	for (const channel of channels) {
		if (cache.isStale(channel) && !pending.has(channel)) void lookUp(channel);
	}

	return { ...message, embeds: decorateEmbeds(message.embeds, cache.get, label) };
}

/**
 * @description Writes each Twitch channel embed's live status into it as messages arrive, load or unfurl, and again
 * when a status lookup finishes.
 * @returns A function that stops the lookups.
 */
export function watchTwitchEmbeds(): () => void {
	running = true;

	const decorateOne = (action: unknown) => {
		const payload = action as MessageAction;

		if (payload.message) payload.message = decorate(payload.message);

		return false;
	};

	flux.interceptAction('MESSAGE_CREATE', decorateOne);
	flux.interceptAction('MESSAGE_UPDATE', decorateOne);
	const decorateMany = (action: unknown) => {
		const payload = action as MessagesAction;

		if (Array.isArray(payload.messages)) payload.messages = payload.messages.map(decorate);

		return false;
	};

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', decorateMany);
	flux.interceptAction('LOAD_MESSAGES_SUCCESS_CACHED', decorateMany);
	flux.interceptAction('LOCAL_MESSAGES_LOADED', decorateMany);

	return () => {
		running = false;
		shown.clear();
	};
}

export default watchTwitchEmbeds;
