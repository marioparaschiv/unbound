import { View } from 'react-native';
import { patcher } from '@unbound-app/api';

import { ChatInputSendButton, SelectedChannelStore } from '~/preview/modules';
import PreviewButton from '~/preview/components/preview-button';
import { Button } from '~/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the send button, where Android keeps it while a draft is typed; Android collapses the right-hand actions as soon as there is text.
 * Patches the render of `ChatInputSendButton`, and reads the channel from `SelectedChannelStore`.
 * @param icon The eye icon's asset id.
 */
export function patchChatInputSendButton(icon: number): void {
	patcher.react.after(ChatInputSendButton, 'default', ({ props, result }) => {
		if (!result) return;

		const channelProps: SendButtonProps | undefined = props;
		const channelId = channelProps?.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return (
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<PreviewButton
					key='unbound-preview-message'
					channelId={channelId}
					icon={icon}
					trailingGap={Button.gap}
				/>
				{result}
			</View>
		);
	});
}
