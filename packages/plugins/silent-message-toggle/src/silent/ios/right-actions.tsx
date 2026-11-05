import { patcher } from '@unbound-app/api';
import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

import SilentToggleButton, { type ToggleIcons } from '~/silent/components/silent-toggle-button';
import { ChatInputRightActions, SelectedChannelStore } from '~/silent/modules';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the chat input's right-hand actions, which iOS keeps on screen while you type.
 * @param icons The toggle's asset ids.
 */
export function patchChatInputRightActions(icons: ToggleIcons): void {
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
				icons={icons}
			/>,
			...Children.toArray(result.props.children),
		);
	});
}
