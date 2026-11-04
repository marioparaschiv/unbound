import { patcher } from '@unbound-app/api';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { View } from 'react-native';

import SilentToggleButton, { type ToggleIcons } from '~/components/silent-toggle-button';
import { SelectedChannelStore } from '~/modules';
import { Button, PLUGIN_NAME } from '~/constants';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the toggle in front of the send button, since Android collapses the right-hand actions as soon as there is text.
 * @param icons The toggle's asset ids.
 * @returns A function that stops waiting for the module or removes the patch.
 */
export function patchChatInputSendButton(icons: ToggleIcons): () => void {
	return whenLoaded(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error(`[${PLUGIN_NAME}] Skipped, the send button has no render function.`);

				return () => {};
			}

			return patcher.after(target.holder, target.key, ({ args, result }) => {
				if (!result) return;

				const props: SendButtonProps | undefined = args[0];
				const channelId = props?.channel?.id ?? SelectedChannelStore.getChannelId();

				if (!channelId) return;

				return (
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<SilentToggleButton
							key='unbound-silent-message-toggle'
							channelId={channelId}
							icons={icons}
							trailingGap={Button.gap}
						/>
						{result}
					</View>
				);
			});
		},
	);
}
