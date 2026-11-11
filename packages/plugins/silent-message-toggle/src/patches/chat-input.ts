import { definePlatform } from '@unbound-app/api/native';
import { assets, metro } from '@unbound-app/api';

import { patchChatInputSendButton as android } from '~/patches/android/chat-input';
import { patchChatInputRightActions as ios } from '~/patches/ios/chat-input';
import { Icons } from '~/lib/constants';

const drawToggle = definePlatform({ ios, android });

/**
 * @description Adds the silent toggle to the chat input: in front of `ChatInputRightActions` on iOS, or of
 * `ChatInputSendButton` on Android.
 */
export function patchChatInput(): void {
	// Without Messages the toggle could not flag a send; patchMessageActions already warned.
	if (!metro.api.Messages) {
		return;
	}

	const on = assets.getIdByName(Icons.on);
	const off = assets.getIdByName(Icons.off);

	if (on === undefined || off === undefined) {
		logger.warn('Silent toggle skipped: the bell icon assets were not found.');

		return;
	}

	drawToggle({
		icons: { on, off },
		haptics: metro.findByFilePath('modules/haptics/HapticUtils.native.tsx'),
	});
}
