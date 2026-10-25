import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { View } from 'react-native';

import { Patcher, SelectedChannelStore } from '~/modules';
import PreviewButton from '~/components/preview-button';

type SendButtonProps = {
	channel?: { id?: string };
};

/**
 * @description Adds the preview button in front of the send button, where Android keeps it while a draft is typed; Android collapses the right-hand actions as soon as there is text.
 * @param icon The eye icon's asset id.
 * @returns A function that stops waiting for the module or removes the patch.
 */
export function patchChatInputSendButton(icon: number): () => void {
	return whenLoaded(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error(
					'[Preview Message] Not starting, the send button has no render function.',
				);

				return () => {};
			}

			return Patcher.after(target.holder, target.key, ({ args, result }) => {
				if (!result) return;

				const props: SendButtonProps | undefined = args[0];
				const channelId = props?.channel?.id ?? SelectedChannelStore.getChannelId();

				if (!channelId) return;

				return (
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<PreviewButton
							key='unbound-preview-message'
							channelId={channelId}
							icon={icon}
						/>
						{result}
					</View>
				);
			});
		},
	);
}

export default patchChatInputSendButton;
