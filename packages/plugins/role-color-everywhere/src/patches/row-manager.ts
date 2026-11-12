import type { MetroFunction } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { roleMentionColors } from '~/native/mentions';
import { applyChatRoleColors } from '~/lib/chat-rows';
import { GuildMemberStore } from '~/lib/modules';

/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, by patching
 * `RowManager.prototype.generate` once `RowManager` loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.warn('Chat skipped: Discord moved RowManager.prototype.generate.');

			return;
		}

		// Always on, even with both chat settings off, so turning tinting off restores reused rows.
		patcher.after(RowManager.prototype, 'generate', ({ result }) => {
			applyChatRoleColors(result, GuildMemberStore, {
				chatMentions: settings.chatMentions,
				roleMentionColors,
				colorChatMessages: settings.colorChatMessages,
				messageSaturation: settings.messageSaturation,
			});
		});
	});
}
