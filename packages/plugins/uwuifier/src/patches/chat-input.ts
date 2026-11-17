import { patchChatInputToggle } from '@unbound-plugins/shared/composer/input-toggle';
import { useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { uwuToggle } from '~/lib/toggle';

/**
 * @description Adds the UwUifier toggle to the chat input.
 */
export function patchChatInput(): void {
	if (!metro.api.Messages) return;

	patchChatInputToggle({
		key: 'unbound-uwuifier-toggle',
		name: 'Uwuifier',
		icons: { on: 'EmojiSmilingFaceWithHeartsIcon', off: 'EmojiSmilingFaceWithHeartsIcon' },
		toggle: uwuToggle,
		usePersist: () => useSetting('persistState'),
		hideWhenEmpty: true,
		labels: () => ({
			name: messages.UWUIFIER,
			toggledOn: messages.TOGGLED_ON,
			toggledOff: messages.TOGGLED_OFF,
			enable: messages.ENABLE_UWU,
			disable: messages.DISABLE_UWU,
		}),
	});
}
