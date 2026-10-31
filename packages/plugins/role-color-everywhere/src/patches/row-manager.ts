import { trackChangedRows } from '@unbound-plugins/shared/messages/changed-rows';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { MetroFunction } from '@unbound-app/api/metro';
import { flux, patcher } from '@unbound-app/api';

import {
	byRowManager,
	GuildMemberStore,
	MessageStore,
	ReferencedMessageStore,
	settings,
} from '~/modules';
import { applyChatRoleColors } from '~/chat-rows';
import { PLUGIN_NAME } from '~/constants';
import { roleMentionColors } from '~/platform';
import type { Message } from '~/types';

function isLoaded(channelId: string, id: string) {
	return Boolean(
		MessageStore.getMessage(channelId, id) ??
		ReferencedMessageStore.getMessage(channelId, id)?.message,
	);
}

function repliedTo(message: Message | undefined) {
	const reference = message?.messageReference;

	if (!reference) return;

	return { id: reference.message_id, channel_id: reference.channel_id };
}

/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, once `RowManager` loads.
 * @returns A function that stops waiting for `RowManager`, removes the patch and has Discord rebuild the rows it colored.
 */
export function patchRowManager(): () => void {
	const colored = trackChangedRows(PLUGIN_NAME, { isLoaded, dispatch: flux.dispatch });

	return whenLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			console.error(`[${PLUGIN_NAME}: chat] Skipped, RowManager has no generate method.`);

			return;
		}

		// Always on, even with both chat settings off, so turning tinting off restores reused rows.
		const unpatch = patcher.after(RowManager.prototype, 'generate', ({ args, result }) => {
			const painted = applyChatRoleColors(result, GuildMemberStore, {
				chatMentions: settings.get('chatMentions', true),
				roleMentionColors,
				colorChatMessages: settings.get('colorChatMessages', false),
				messageSaturation: settings.get('messageSaturation', 30),
			});

			if (!painted) return;

			const message: Message | undefined = args[0]?.message;

			colored.add(message);
			// The reply preview shows the replied-to message's parsed content, which keeps its colors until that record changes too.
			colored.add(repliedTo(message));
		});

		return () => {
			unpatch();
			colored.rebuild();
		};
	});
}

export default patchRowManager;
