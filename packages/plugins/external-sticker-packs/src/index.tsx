import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';
import type { PluginContext } from '@unbound-app/api/native';
import { messages } from '@unbound-app/i18n';
import { patcher } from '@unbound-app/api';

import { openStickerSheet } from '~/components/sticker-sheet';

export function start(context: PluginContext) {
	patchChatInputButton({
		key: 'unbound-external-sticker-packs',
		name: 'External Sticker Packs',
		icon: 'StickerIcon',
		label: () => messages.BUTTON,
		showWhenEmpty: true,
		onPress: (channelId) => openStickerSheet(channelId, context.tempPath),
	});
}

export function stop() {
	patcher.unpatchAll();
}
