import { patcher } from '@unbound-app/api';

import type { SendButtonRef, Staging } from '~/sticker-staging/staging';
import { ChatInputSendButton } from '~/sticker-staging/modules';

type SendButtonProps = { channel?: { id?: string }; ref?: SendButtonRef };

/**
 * @description Lets the send button send a staged sticker, and keeps its ref so the plugin can update it.
 * @param staging The plugin's staged stickers.
 * @returns A function that removes the patch.
 */
export function patchChatInputSendButton(staging: Staging): () => void {
	return patcher.react.before(
		ChatInputSendButton,
		'default',
		({ props }: { props: SendButtonProps }) => {
			const channelId = props.channel?.id;

			if (!channelId) return;

			if (props.ref) staging.trackSendButton(channelId, props.ref);

			if (!staging.get(channelId).length) return;

			return {
				...props,
				hasPendingAttachments: true,
				requireTextContent: false,
				onSendMessage: (...sendArgs: unknown[]) => staging.send(channelId, ...sendArgs),
			};
		},
	);
}
