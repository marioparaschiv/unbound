import { metro, patcher } from '@unbound-app/api';
import { createElement } from 'react';
import { View } from 'react-native';

import { channelOf, type ToggleButtonFactory } from '../toggle-channel';

const BUTTON_GAP = 8;

/**
 * @description Puts the toggle in front of `ChatInputSendButton`, since Android collapses the right-hand actions once there is text.
 * @param button Draws the toggle for a channel.
 * @param name What log lines call the toggle.
 */
export function patchSendButton(button: ToggleButtonFactory, name: string): void {
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

		return createElement(
			View,
			{ style: { flexDirection: 'row', alignItems: 'center' } },
			button(channelId, BUTTON_GAP),
			result,
		);
	});
}

export default patchSendButton;
