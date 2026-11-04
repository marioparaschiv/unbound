import type { FluxAction } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { REACTION_DEDUPE_WINDOW } from '~/constants';
import { SelectedChannelStore } from '~/moyai/modules';
import { isMoyaiReaction } from '~/moyai/matchers';
import type { Player } from '~/moyai/sound';

type ReactionAdd = FluxAction & {
	channelId?: string;
	channel_id?: string;
	messageId?: string;
	message_id?: string;
	emoji?: { name?: string };
};

/**
 * @description Plays the sound when a Moyai reaction lands in the selected channel, once per message and emoji, while `allowReactions` is on.
 * @param player The plugin's sound player.
 */
export function playOnReactions(player: Player): void {
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

		void player.play();
	}

	flux.onAction('MESSAGE_REACTION_ADD', onReactionAdd);
}
