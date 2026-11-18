import { withComposerButton } from '@unbound-plugins/shared/composer/composer-stack';
import { isValidElement } from 'react';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { SelectedChannelStore, type PreviewModules } from '~/lib/modules';
import PreviewButton from '~/components/preview-button';
import PreviewRow from '~/components/preview-row';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the chat input's right-hand actions, or above them once the draft is crowded.
 * Patches the render of `ChatInputRightActions`, and reads the channel from `SelectedChannelStore`.
 * @param icon The eye icon's asset id.
 * @param modules The modules the preview draws with.
 */
export function patchChatInputRightActions(icon: number, modules: PreviewModules): void {
	const ChatInputRightActions = metro.findByFilePath(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);

	if (!ChatInputRightActions) {
		logger.warn('Preview button skipped: Discord moved ChatInputRightActions.');

		return;
	}

	patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
		if (!isValidElement(result)) return;

		const channelProps: RightActionsProps | undefined = props;
		const channelId = channelProps?.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return withComposerButton(result, {
			channelId,
			key: 'preview-message',
			details: {
				label: () => messages.PREVIEW_MESSAGE,
				row: (rowChannelId, closePanel) => (
					<PreviewRow
						key='unbound-preview-message-row'
						channelId={rowChannelId}
						icon={icon}
						closePanel={closePanel}
					/>
				),
			},
			draw: () => (
				<PreviewButton
					key='unbound-preview-message'
					channelId={channelId}
					icon={icon}
					modules={modules}
				/>
			),
			inline: 'prepend',
			rowGap: 0,
		});
	});
}
