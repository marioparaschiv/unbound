import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import { ChatInputRightActions, SelectedChannelStore } from '~/preview/modules';
import PreviewButton from '~/preview/components/preview-button';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the chat input's right-hand actions.
 * Patches the render of `ChatInputRightActions`, and reads the channel from `SelectedChannelStore`.
 * @param icon The eye icon's asset id.
 */
export function patchChatInputRightActions(icon: number): void {
	patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
		if (!isValidElement<{ children?: ReactNode }>(result)) return;

		const channelProps: RightActionsProps | undefined = props;
		const channelId = channelProps?.channel?.id ?? SelectedChannelStore.getChannelId();

		if (!channelId) return;

		return cloneElement(
			result,
			undefined,
			<PreviewButton key='unbound-preview-message' channelId={channelId} icon={icon} />,
			...Children.toArray(result.props.children),
		);
	});
}
