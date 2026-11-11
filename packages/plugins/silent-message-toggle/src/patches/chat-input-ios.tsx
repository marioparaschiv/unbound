import { flux, metro, patcher } from '@unbound-app/api';
import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

import SilentToggleButton, { type ToggleTools } from '~/components/silent-toggle-button';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the chat input's right-hand actions, which iOS keeps on screen while you type.
 * @param tools The toggle's asset ids and Discord's haptics.
 */
export function patchChatInputRightActions(tools: ToggleTools): void {
	const ChatInputRightActions = metro.findByFilePath(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);

	if (!ChatInputRightActions) {
		logger.warn('Silent toggle skipped: Discord moved ChatInputRightActions.');

		return;
	}

	const SelectedChannelStore = flux.getStore('SelectedChannel');

	patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
		if (!isValidElement<{ children?: ReactNode }>(result)) return;

		const actions: RightActionsProps = props;
		const channelId = actions.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return cloneElement(
			result,
			undefined,
			<SilentToggleButton
				key='unbound-silent-message-toggle'
				channelId={channelId}
				{...tools}
			/>,
			...Children.toArray(result.props.children),
		);
	});
}
