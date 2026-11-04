import { startFeatures } from '@unbound-plugins/shared/lifecycle/start-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { assets } from '@unbound-app/api';

import { Messages, SelectedChannelStore } from '~/silent/modules';
import { resetOnChannelSwitch } from '~/silent/channel-switch';
import { patchMessageActions } from '~/silent/message-actions';
import { startToggleButton } from '~/silent/platform';
import { Icons, PLUGIN_NAME } from '~/constants';

/**
 * @description Adds the silent toggle to the chat input and flags the messages sent while it is on.
 * Patches `_sendMessage` on Discord's message actions, listens to `SelectedChannelStore`, and patches the
 * render of `ChatInputRightActions` on iOS or `ChatInputSendButton` on Android. The Addon scope removes all of it when the plugin stops. One feature failing is logged and recorded, and the others still start.
 */
export function startSilent(): void {
	const on = assets.getIdByName(Icons.on);
	const off = assets.getIdByName(Icons.off);

	if (!ensureModules(PLUGIN_NAME, { Messages, SelectedChannelStore })) return;

	if (on === undefined || off === undefined) {
		console.error(`[${PLUGIN_NAME}] Skipped, the bell icon assets were not found.`);

		return;
	}

	startFeatures(PLUGIN_NAME, [
		patchMessageActions,
		resetOnChannelSwitch,
		() => startToggleButton({ on, off }),
	]);
}
