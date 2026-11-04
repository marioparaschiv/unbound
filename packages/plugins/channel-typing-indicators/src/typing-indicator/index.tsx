import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { metro } from '@unbound-app/api';

import { patchThreadChannel } from '~/typing-indicator/thread-channel';
import { patchTextChannel } from '~/typing-indicator/text-channel';

/**
 * @description Shows who is typing on channel and thread rows of the channel list.
 * Patches the renders of `TextChannel` (`modules/channel_list_v2/native/items/TextChannel.tsx`) and `ThreadChannel`
 * (`.../items/ThreadChannel.tsx`), and reads `TypingStore`, `UserStore`, `RelationshipStore`, `SelectedChannelStore`,
 * `UserGuildSettingsStore` and `GuildMemberStore`, `UserSummaryItem`, `UserProfileActionSheet` and the tooltip module.
 * The Addon scope removes both patches when the plugin stops, and the rows draw without the indicator again.
 */
export function startTypingIndicators(): void {
	if (!ensureModules('Channel Typing Indicators', { Theme: metro.common.Theme })) return;

	patchTextChannel();
	patchThreadChannel();
	recordApplied(2);
}
