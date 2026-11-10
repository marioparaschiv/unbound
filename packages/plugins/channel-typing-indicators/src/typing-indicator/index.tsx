import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import { metro } from '@unbound-app/api';

import { patchThreadChannel } from '~/typing-indicator/thread-channel';
import { patchTextChannel } from '~/typing-indicator/text-channel';

/**
 * @description Shows who is typing on channel and thread rows of the channel list.
 * Patches the renders of `TextChannel` (`modules/channel_list_v2/native/items/TextChannel.tsx`) and `ThreadChannel`
 * (`.../items/ThreadChannel.tsx`), and reads `TypingStore`, `UserStore`, `RelationshipStore`, `SelectedChannelStore`,
 * `UserGuildSettingsStore` and `GuildMemberStore`, `UserSummaryItem`, `UserProfileActionSheet` and the tooltip module.
 * The Addon scope removes both patches when the plugin stops, and the rows draw without the indicator again.
 * A patch that throws on an unexpected component is logged and recorded, and the other still applies.
 */
export function typingIndicatorFeatures(): Feature[] | undefined {
	if (!ensureModules({ Theme: metro.common.Theme })) return;

	return [patchTextChannel, patchThreadChannel];
}
