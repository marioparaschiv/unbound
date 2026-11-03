import { patcher } from '@unbound-app/api';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { Children, cloneElement } from 'react';

import SilentToggleButton, { type ToggleIcons } from '~/components/silent-toggle-button';
import { SelectedChannelStore } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

type RightActionsProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the chat input's right-hand actions, which iOS keeps on screen while you type.
 * @param icons The toggle's asset ids.
 * @returns A function that stops waiting for the module or removes the patch.
 */
export function patchChatInputRightActions(icons: ToggleIcons): () => void {
	return whenLoaded(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error(
					`[${PLUGIN_NAME}] Skipped, the chat input actions have no render function.`,
				);

				return () => {};
			}

			return patcher.after(target.holder, target.key, ({ args, result }) => {
				if (!result?.props) return;

				const props: RightActionsProps | undefined = args[0];
				const channelId = props?.channel?.id ?? SelectedChannelStore.getChannelId();

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
		},
	);
}
