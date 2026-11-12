import { Portal } from '@unbound-app/api/metro/components';
import { assets, native } from '@unbound-app/api';

import { findPreviewModules } from '~/lib/modules';
import { patchChatInputRightActions } from '~/patches/ios/chat-input';
import { patchChatInputSendButton } from '~/patches/android/chat-input';

const patchPreviewButton = native.definePlatform({
	ios: patchChatInputRightActions,
	android: patchChatInputSendButton,
});

/**
 * @description Adds a button to the chat input that previews the draft as Discord would render it once sent.
 * Patches the render of `ChatInputRightActions` on iOS and `ChatInputSendButton` on Android. The preview draws with
 * `ChatItem`, builds its message with `MessageRecord` and `RowManager`, and reads the draft from `DraftStore`, the
 * channel from `SelectedChannelStore` and the author from `UserStore`.
 */
export function patchChatInput(): void {
	const EyeIcon = assets.getIdByName('EyeIcon');
	const modules = findPreviewModules();

	if (!modules || !Portal) {
		logger.warn(
			'Preview skipped: Discord moved ChatItem, MessageRecord, RowManager or Portal.',
		);

		return;
	}

	if (EyeIcon === undefined) {
		logger.warn('Preview skipped: the EyeIcon asset was not found.');

		return;
	}

	patchPreviewButton(EyeIcon, modules);
}
