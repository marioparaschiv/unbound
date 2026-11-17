import { metro, patcher } from '@unbound-app/api';

import { channelOf, type ToggleButtonFactory } from '../toggle-channel';
import { withComposerButton } from '../composer-stack';

const BUTTON_GAP = 8;

/**
 * @description Puts the toggle in front of `ChatInputSendButton`, since Android collapses the right-hand actions once there is text;
 * a crowded draft stacks it above the send button instead.
 * @param button Draws the toggle for a channel.
 * @param name What log lines call the toggle.
 * @param key The button's key, which the Plugin Shortcut Panel collects buttons by.
 */
export function patchSendButton(button: ToggleButtonFactory, name: string, key?: string): void {
	const SendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);

	if (!SendButton) {
		logger.warn(`${name} toggle skipped: Discord moved ChatInputSendButton.`);

		return;
	}

	patcher.react.after(SendButton, 'default', ({ props, result }) => {
		const channelId = channelOf(props);

		if (!channelId || !result) return;

		return withComposerButton(result, {
			channelId,
			draw: (gap: number) => button(channelId, gap),
			key,
			inline: 'row',
			rowGap: BUTTON_GAP,
		});
	});
}

export default patchSendButton;
