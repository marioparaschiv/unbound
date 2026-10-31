import { patcher } from '@unbound-app/api';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { MetroFunction } from '@unbound-app/api/metro';

import { byRowManager, GuildMemberStore, settings } from '~/modules';
import { applyChatRoleColors } from '~/chat-rows';
import { PLUGIN_NAME } from '~/constants';
import { roleMentionColors } from '~/platform';

/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, once `RowManager` loads.
 * @returns A function that stops waiting for `RowManager` and removes the patch.
 */
export function patchRowManager(): () => void {
	return whenLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			console.error(`[${PLUGIN_NAME}: chat] Skipped, RowManager has no generate method.`);

			return;
		}

		// Always on, even with both chat settings off, so turning tinting off restores reused rows.
		return patcher.after(RowManager.prototype, 'generate', ({ result }) => {
			applyChatRoleColors(result, GuildMemberStore, {
				chatMentions: settings.get('chatMentions', true),
				roleMentionColors,
				colorChatMessages: settings.get('colorChatMessages', false),
				messageSaturation: settings.get('messageSaturation', 30),
			});
		});
	});
}

export default patchRowManager;
