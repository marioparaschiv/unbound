import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import { metro } from '@unbound-app/api';

import { PLUGIN_NAME } from '~/constants';
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
export function startTypingIndicators(): () => Promise<void> {
	if (!ensureModules(PLUGIN_NAME, { Theme: metro.common.Theme })) return async () => {};

	return startFeatures(PLUGIN_NAME, [patchTextChannel, patchThreadChannel]);
}
