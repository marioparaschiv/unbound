import { flux } from '@unbound-app/api';

import { MESSAGE_PLAY_INTERVAL } from '~/constants';
import { SelectedChannelStore } from '~/modules';
import { countMoyai } from '~/matchers';
import type { Player } from '~/sound';

type MessageCreate = {
	channelId?: string;
	channel_id?: string;
	message?: { channel_id?: string; content?: string; state?: string };
};

/**
 * @description Plays the sound once per Moyai in each message received in the selected channel.
 * @param player The plugin's sound player.
 * @returns A function that unsubscribes.
 */
export function subscribeMessages(player: Player): () => void {
	function onMessageCreate({ channelId, channel_id, message }: MessageCreate) {
		// A message with a `state` is the user's own pending send, not a received one.
		if (!message?.content || message.state) return;

		const channel = channelId ?? channel_id ?? message.channel_id;

		if (channel !== SelectedChannelStore.getChannelId()) return;

		for (let i = 0, count = countMoyai(message.content); i < count; i++) {
			setTimeout(() => void player.play(), i * MESSAGE_PLAY_INTERVAL);
		}
	}

	return flux.onAction('MESSAGE_CREATE', onMessageCreate);
}
