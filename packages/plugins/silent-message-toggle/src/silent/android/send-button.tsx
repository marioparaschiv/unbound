import { patcher } from '@unbound-app/api';
import { View } from 'react-native';

import SilentToggleButton, { type ToggleIcons } from '~/silent/components/silent-toggle-button';
import { ChatInputSendButton, SelectedChannelStore } from '~/silent/modules';
import { Button } from '~/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the send button, since Android collapses the right-hand actions as soon as there is text.
 * @param icons The toggle's asset ids.
 */
export function patchChatInputSendButton(icons: ToggleIcons): void {
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
					icons={icons}
					trailingGap={Button.gap}
				/>
				{result}
			</View>
		);
	});
}
