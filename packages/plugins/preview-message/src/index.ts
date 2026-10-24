import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { Portal } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { Platform } from 'react-native';

import { patchChatInputRightActions } from '~/patches/chat-input-right-actions';
import { patchChatInputSendButton } from '~/patches/chat-input-send-button';
import {
	ChatItem,
	DraftStore,
	FluxHooks,
	MessageRecord,
	PreviewRunning,
	RowManager,
	SelectedChannelStore,
	Users,
} from '~/modules';

let dispose = () => {};

function start() {
	const EyeIcon = assets.getIDByName('EyeIcon');

	const ready = ensureModules('Preview Message', {
		ChatItem,
		MessageRecord,
		RowManager,
		DraftStore,
		SelectedChannelStore,
		FluxHooks,
		Portal,
		Users,
	});

	if (!ready) return;

	if (EyeIcon === undefined) {
		console.error('[Preview Message] Skipped, the EyeIcon asset was not found.');

		return;
	}

	dispose = applyFeatures('Preview Message', [
		PreviewRunning.markRunning,
		() =>
			Platform.OS === 'android'
				? patchChatInputSendButton(EyeIcon)
				: patchChatInputRightActions(EyeIcon),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
