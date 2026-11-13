import { patchChatInputToggle } from '@unbound-plugins/shared/composer/input-toggle';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { typingToggle } from '~/lib/toggle';

const Icons = { on: 'EyeSlashIcon', off: 'EyeIcon' };

function hidesTyping(channelId: unknown): boolean {
	return (
		!settings.showButton ||
		typeof channelId !== 'string' ||
		typingToggle.isActive(channelId, true)
	);
}

/**
 * @description Stops Discord from telling others you are typing while the toggle is on.
 * Patches `startTyping` on Discord's typing actions.
 */
export function patchTyping(): void {
	const Typing = metro.findByFilePath('actions/TypingActionCreators.tsx')?.default;

	if (typeof Typing?.startTyping !== 'function') {
		logger.warn('Silent typing skipped: Discord moved TypingActionCreators.');

		return;
	}

	patcher.instead(Typing, 'startTyping', ({ args, original, this: self }) =>
		hidesTyping(args[0]) ? undefined : original.apply(self, args),
	);
}

/**
 * @description Adds the toggle that turns silent typing on and off to the chat input.
 */
export function patchChatInput(): void {
	if (!settings.showButton) return;

	patchChatInputToggle({
		key: 'unbound-silent-typing-toggle',
		name: 'Silent typing',
		icons: Icons,
		toggle: typingToggle,
		usePersist: () => true,
		labels: () => ({
			name: messages.SILENT_TYPING,
			toggledOn: messages.TOGGLED_ON,
			toggledOff: messages.TOGGLED_OFF,
			enable: messages.ENABLE_SILENT_TYPING,
			disable: messages.DISABLE_SILENT_TYPING,
		}),
	});
}
