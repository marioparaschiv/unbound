import { patchChatInputToggle } from '@unbound-plugins/shared/composer/input-toggle';
import { useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { aussieToggle } from '~/lib/toggle';

/**
 * @description Adds the Aussie Speech toggle to the chat input.
 */
export function patchChatInput(): void {
	// Without Messages nothing is translated; patchMessageActions already warned.
	if (!metro.api.Messages) {
		return;
	}

	patchChatInputToggle({
		key: 'unbound-aussie-speech-toggle',
		name: 'Aussie Speech',
		icons: { on: 'LanguageIcon', off: 'LanguageIcon' },
		toggle: aussieToggle,
		usePersist: () => useSetting('persistState'),
		labels: () => ({
			name: messages.AUSSIE_SPEECH,
			toggledOn: messages.TOGGLED_ON,
			toggledOff: messages.TOGGLED_OFF,
			enable: messages.ENABLE_AUSSIE_SPEECH,
			disable: messages.DISABLE_AUSSIE_SPEECH,
		}),
	});
}
