import type { MetroFunction } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { byRowManager, GuildMemberStore } from '~/chat/modules';
import { applyChatRoleColors } from '~/chat/chat-rows';
import { roleMentionColors } from '~/chat/platform';

/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, once `RowManager` loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.error('Skipped chat, RowManager has no generate method.');

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
