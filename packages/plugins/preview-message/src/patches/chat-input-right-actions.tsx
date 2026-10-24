import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { Children, cloneElement } from 'react';

import { Patcher, SelectedChannelStore } from '~/modules';
import PreviewButton from '~/components/preview-button';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the chat input's right-hand actions.
 * @param icon The eye icon's asset id.
 * @returns A function that stops waiting for the module or removes the patch.
 */
export function patchChatInputRightActions(icon: number): () => void {
	return whenLoaded(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error(
					'[Preview Message] Not starting, the chat input actions have no render function.',
				);

				return () => {};
			}

			return Patcher.after(target.holder, target.key, ({ args, result }) => {
				if (!result?.props) return;

				const props: RightActionsProps | undefined = args[0];
				const channelId = props?.channel?.id ?? SelectedChannelStore.getChannelId();

				if (!channelId) return;

				return cloneElement(
					result,
					undefined,
					<PreviewButton
						key='unbound-preview-message'
						channelId={channelId}
						icon={icon}
					/>,
					...Children.toArray(result.props.children),
				);
			});
		},
	);
}
