import { patchChatInputToggle } from '@unbound-plugins/shared/composer/input-toggle';
import { useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { silentToggle } from '~/lib/toggle';
import { Icons } from '~/lib/constants';

/**
 * @description Adds the silent toggle to the chat input.
 */
export function patchChatInput(): void {
	// Without Messages the toggle could not flag a send; patchMessageActions already warned.
	if (!metro.api.Messages) {
		return;
	}

	patchChatInputToggle({
		key: 'unbound-silent-message-toggle',
		name: 'Silent',
		icons: Icons,
		toggle: silentToggle,
		usePersist: () => useSetting('persistState'),
		labels: () => ({
			name: messages.SILENT_MESSAGE_TOGGLE,
			toggledOn: messages.TOGGLED_ON,
			toggledOff: messages.TOGGLED_OFF,
			enable: messages.ENABLE_SILENT_MESSAGE,
			disable: messages.DISABLE_SILENT_MESSAGE,
		}),
	});
}
