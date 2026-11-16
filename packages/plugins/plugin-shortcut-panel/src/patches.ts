import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { messages } from '@unbound-app/i18n';

import ShortcutSheet from '~/components/shortcut-sheet';

/**
 * @description Adds a shortcuts button to the chat input, shown even while it is empty, that opens the panel.
 */
export function patchShortcutButton(): void {
	patchChatInputButton({
		key: 'plugin-shortcut-panel',
		name: 'Plugin Shortcut Panel',
		icon: 'AppsIcon',
		label: () => messages.BUTTON,
		onPress: (channelId) =>
			openSheet('unbound-plugin-shortcut-panel', ShortcutSheet, { channelId }),
		showWhenEmpty: true,
	});
}

export default { patchShortcutButton };
