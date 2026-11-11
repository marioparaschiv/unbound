import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import { SelectedChannelStore, type PreviewModules } from '~/lib/modules';
import PreviewButton from '~/components/preview-button';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the chat input's right-hand actions.
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
		if (!isValidElement<{ children?: ReactNode }>(result)) return;

		const channelProps: RightActionsProps | undefined = props;
		const channelId = channelProps?.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return cloneElement(
			result,
			undefined,
			<PreviewButton
				key='unbound-preview-message'
				channelId={channelId}
				icon={icon}
				modules={modules}
			/>,
			...Children.toArray(result.props.children),
		);
	});
}
