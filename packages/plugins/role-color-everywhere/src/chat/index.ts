import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { storage } from '@unbound-app/api';

import { createNativeMentions } from '~/chat/native-mentions';
import { patchRowManager } from '~/chat/row-manager';
import { GuildMemberStore } from '~/chat/modules';
import { PLUGIN_NAME } from '~/constants';

const bucket = storage.getBucket();

let stopNativeMentions = () => {};
let settled = () => Promise.resolve();

/**
 * @description Colors mentions and message text in chat rows, and mentions in native message cells and the chat input.
 * Patches `RowManager.prototype.generate`, and on iOS and Android hooks native views through the plugin's native bridge;
 * reads `GuildMemberStore`, `UserStore`, `ChannelStore`, `MessageStore` and `SelectedChannelStore`.
 * The Addon scope removes the patch, but native views are restored by `stopChat`.
 * @param context The plugin context, whose native bridge paints the mentions.
 */
export function startChat(context: PluginContext): void {
	if (!ensureModules(PLUGIN_NAME, { GuildMemberStore })) return;

	const nativeMentions = createNativeMentions(context);

	patchRowManager();
	settled = nativeMentions.settled;
	stopNativeMentions = whileEnabled(bucket, 'chatMentions', true, nativeMentions.enable);
	recordApplied(1);
}

/**
 * @description Restores the native views the plugin painted, and waits for the restore to finish.
 * @returns A promise that settles once every queued native step has.
 */
export function stopChat(): Promise<void> {
	stopNativeMentions();
	stopNativeMentions = () => {};

	return settled();
}
