import { withComposerButton } from '@unbound-plugins/shared/composer/composer-stack';
import { metro, patcher } from '@unbound-app/api';

import { SelectedChannelStore, type PreviewModules } from '~/lib/modules';
import PreviewButton from '~/components/preview-button';
import { Button } from '~/lib/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the send button, where Android keeps it while a draft is typed; Android collapses the right-hand actions as soon as there is text. A crowded draft stacks it above the send button.
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

		return withComposerButton(result, {
			channelId,
			draw: (gap) => (
				<PreviewButton
					key='unbound-preview-message'
					channelId={channelId}
					icon={icon}
					modules={modules}
					trailingGap={gap}
				/>
			),
			inline: 'row',
			rowGap: Button.gap,
		});
	});
}
