import type { RenderTarget } from '@unbound-plugins/shared/react/render-target';

import type { SendButtonRef, Staging } from '~/staging';
import { Patcher } from '~/modules';

type SendButtonProps = { channel?: { id?: string }; ref?: SendButtonRef };

/**
 * @description Lets the send button send a staged sticker, and keeps its ref so the plugin can update it.
 * @param target The render function of `ChatInputSendButton`.
 * @param staging The plugin's staged stickers.
 * @returns A function that removes the patch.
 */
export function patchChatInputSendButton(target: RenderTarget, staging: Staging): () => void {
	return Patcher.before(target.holder, target.key, ({ args }) => {
		const props = args[0] as SendButtonProps | undefined;
		const ref = props?.ref ?? (args[1] as SendButtonRef | undefined);
		const channelId = props?.channel?.id;

		if (!channelId) return;

		if (ref) staging.trackSendButton(channelId, ref);

		if (!staging.get(channelId).length) return;

		args[0] = {
			...props,
			hasPendingAttachments: true,
			requireTextContent: false,
			onSendMessage: (...sendArgs: unknown[]) => staging.send(channelId, ...sendArgs),
		};
	});
}
