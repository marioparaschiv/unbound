import { flux, metro, patcher } from '@unbound-app/api';
import { View } from 'react-native';

import SilentToggleButton, { type ToggleTools } from '~/components/silent-toggle-button';
import { Button } from '~/lib/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the send button, since Android collapses the right-hand actions as soon as there is text.
 * @param tools The toggle's asset ids and Discord's haptics.
 */
export function patchChatInputSendButton(tools: ToggleTools): void {
	const ChatInputSendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);

	if (!ChatInputSendButton) {
		logger.warn('Silent toggle skipped: Discord moved ChatInputSendButton.');

		return;
	}

	const SelectedChannelStore = flux.getStore('SelectedChannel');

	patcher.react.after(ChatInputSendButton, 'default', ({ props, result }) => {
		if (!result) return;

		const sendButton: SendButtonProps = props;
		const channelId = sendButton.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return (
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<SilentToggleButton
					key='unbound-silent-message-toggle'
					channelId={channelId}
					{...tools}
					trailingGap={Button.gap}
				/>
				{result}
			</View>
		);
	});
}
