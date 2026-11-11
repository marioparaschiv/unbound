import type { FluxAction } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { MESSAGE_PLAY_INTERVAL, REACTION_DEDUPE_WINDOW } from '~/constants';
import { countMoyai, isMoyaiReaction } from '~/lib/matchers';
import { playMoyai } from '~/lib/player';

type MessageCreate = {
	channelId?: string;
	channel_id?: string;
	message?: { channel_id?: string; content?: string; state?: string };
};

type ReactionAdd = FluxAction & {
	channelId?: string;
	channel_id?: string;
	messageId?: string;
	message_id?: string;
	emoji?: { name?: string };
};

const SelectedChannelStore = flux.getStore('SelectedChannel');

/**
 * @description Plays the sound once per Moyai in each message received in the selected channel.
 * Listens to the `MESSAGE_CREATE` Flux action.
 */
export function listenToMessages(): void {
	function onMessageCreate({ channelId, channel_id, message }: MessageCreate) {
		// A message with a `state` is the user's own pending send, not a received one.
		if (!message?.content || message.state) return;

		const channel = channelId ?? channel_id ?? message.channel_id;

		if (channel !== SelectedChannelStore.getChannelId()) return;

		for (let i = 0, count = countMoyai(message.content); i < count; i++) {
			setTimeout(playMoyai, i * MESSAGE_PLAY_INTERVAL);
		}
	}

	flux.onAction('MESSAGE_CREATE', onMessageCreate);
}

/**
 * @description Plays the sound when a Moyai reaction lands in the selected channel, once per message and emoji, while `allowReactions` is on.
 * Listens to the `MESSAGE_REACTION_ADD` Flux action.
 */
export function listenToReactions(): void {
	const recent = new Set<string>();

	function onReactionAdd({ channelId, channel_id, messageId, message_id, emoji }: ReactionAdd) {
		if (!settings.allowReactions) return;

		const name = emoji?.name;

		if (!name || !isMoyaiReaction(name)) return;

		if ((channelId ?? channel_id) !== SelectedChannelStore.getChannelId()) return;

		const key = `${messageId ?? message_id}:${name}`;

		if (recent.has(key)) return;

		recent.add(key);
		setTimeout(() => recent.delete(key), REACTION_DEDUPE_WINDOW);

		playMoyai();
	}

	flux.onAction('MESSAGE_REACTION_ADD', onReactionAdd);
}
