import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';

import { createNativeMentions } from '~/chat/native-mentions';
import { patchRowManager } from '~/chat/row-manager';
import { GuildMemberStore } from '~/chat/modules';

/**
 * @description Colors mentions and message text in chat rows, and mentions in native message cells and the chat input.
 * Patches `RowManager.prototype.generate`, and on iOS and Android hooks native views through the plugin's native bridge;
 * reads `GuildMemberStore`, `UserStore`, `ChannelStore`, `MessageStore` and `SelectedChannelStore`.
 * The Addon scope removes the patch, but the returned function restores the native views and waits for it to finish.
 * @param context The plugin context, whose native bridge paints the mentions.
 * @returns The function that ends the feature; its promise settles once every queued native step has.
 */
export function startChat(context: PluginContext): () => Promise<void> {
	if (!ensureModules({ GuildMemberStore })) return () => Promise.resolve();

	const nativeMentions = createNativeMentions(context);

	patchRowManager();
	const stopNativeMentions = whileEnabled(settings, 'chatMentions', true, nativeMentions.enable);

	return () => {
		stopNativeMentions();

		return nativeMentions.settled();
	};
}
