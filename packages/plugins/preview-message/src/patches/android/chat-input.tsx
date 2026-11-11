import { View } from 'react-native';
import { metro, patcher } from '@unbound-app/api';

import { SelectedChannelStore, type PreviewModules } from '~/lib/modules';
import PreviewButton from '~/components/preview-button';
import { Button } from '~/lib/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the send button, where Android keeps it while a draft is typed; Android collapses the right-hand actions as soon as there is text.
 * Patches the render of `ChatInputSendButton`, and reads the channel from `SelectedChannelStore`.
 * @param icon The eye icon's asset id.
 * @param modules The modules the preview draws with.
 */
export function patchChatInputSendButton(icon: number, modules: PreviewModules): void {
	const ChatInputSendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);

	if (!ChatInputSendButton) {
		logger.warn('Preview button skipped: Discord moved ChatInputSendButton.');

		return;
	}

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
					modules={modules}
					trailingGap={Button.gap}
				/>
				{result}
			</View>
		);
	});
}
