import { trackChangedRows } from '@unbound-plugins/shared/messages/changed-rows';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { MetroFunction } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { byRowManager, GuildMemberStore, MessageStore, settings } from '~/modules';
import { applyChatRoleColors } from '~/chat-rows';
import { PLUGIN_NAME } from '~/constants';
import { roleMentionColors } from '~/platform';

/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, once `RowManager` loads.
 * @returns A function that stops waiting for `RowManager`, removes the patch and has Discord rebuild the rows it colored.
 */
export function patchRowManager(): () => void {
	const colored = trackChangedRows((channelId, id) => MessageStore.getMessage?.(channelId, id));

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

			if (painted) colored.add(args[0]?.message);
		});

		return () => {
			unpatch();
			colored.rebuild();
		};
	});
}

export default patchRowManager;
