import type { RenderTarget } from '@unbound-plugins/shared/react/render-target';

import { selectedChannelId } from '~/selected-channel';
import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';
import type { Staging } from '~/staging';
import { Patcher } from '~/modules';

type PickerRowProps = {
	channel?: { id?: string };
	onPressSticker?: (sticker: Sticker, ...args: unknown[]) => unknown;
};

/**
 * @description Stages a sticker picked from the picker instead of sending it.
 * @param target The render function of `StickerPickerListRow`.
 * @param staging The plugin's staged stickers.
 * @returns A function that removes the patch.
 */
export function patchStickerPickerListRow(target: RenderTarget, staging: Staging): () => void {
	return Patcher.before(target.holder, target.key, ({ args }) => {
		const props = args[0] as PickerRowProps | undefined;
		const onPressSticker = props?.onPressSticker;

		if (typeof onPressSticker !== 'function') return;

		args[0] = {
			...props,
			onPressSticker: (sticker: Sticker, ...rest: unknown[]) => {
				const channelId = props?.channel?.id ?? selectedChannelId();

				if (!channelId) return onPressSticker.call(props, sticker, ...rest);

				staging.stage(channelId, sticker);
			},
		};
	});
}
