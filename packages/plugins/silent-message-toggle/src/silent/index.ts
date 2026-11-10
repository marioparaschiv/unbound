import { skipFeature, type Feature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { assets } from '@unbound-app/api';

import { Messages, SelectedChannelStore } from '~/silent/modules';
import { resetOnChannelSwitch } from '~/silent/channel-switch';
import { patchMessageActions } from '~/silent/message-actions';
import { startToggleButton } from '~/silent/platform';
import { Icons } from '~/constants';

/**
 * @description Adds the silent toggle to the chat input and flags the messages sent while it is on.
 * Patches `_sendMessage` on Discord's message actions, listens to `SelectedChannelStore`, and patches the
 * render of `ChatInputRightActions` on iOS or `ChatInputSendButton` on Android. The Addon scope removes all of it when the plugin stops.
 * @returns The features, each started on its own; `undefined` when the plugin skipped starting.
 */
export function startSilent(): Feature[] | undefined {
	const on = assets.getIdByName(Icons.on);
	const off = assets.getIdByName(Icons.off);

	if (!ensureModules({ Messages, SelectedChannelStore })) return;

	if (on === undefined || off === undefined) {
		skipFeature('the bell icon assets were not found');

		return;
	}

	return [patchMessageActions, resetOnChannelSwitch, () => startToggleButton({ on, off })];
}
