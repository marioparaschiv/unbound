import { patcher } from '@unbound-app/api';

import { selectedChannelId } from '~/sticker-staging/selected-channel';
import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';
import { StickerPickerListRow } from '~/sticker-staging/modules';
import type { Staging } from '~/sticker-staging/staging';

type PickerRowProps = {
	channel?: { id?: string };
	onPressSticker?: (sticker: Sticker, ...args: unknown[]) => unknown;
};

/**
 * @description Stages a sticker picked from the picker instead of sending it.
 * @param staging The plugin's staged stickers.
 */
export function patchStickerPickerListRow(staging: Staging): void {
	patcher.react.before(
		StickerPickerListRow,
		'default',
		({ props }: { props: PickerRowProps }) => {
			const onPressSticker = props.onPressSticker;

			if (typeof onPressSticker !== 'function') return;

			return {
				...props,
				onPressSticker: (sticker: Sticker, ...rest: unknown[]) => {
					const channelId = props.channel?.id ?? selectedChannelId();

					if (!channelId) return onPressSticker.call(props, sticker, ...rest);

					staging.stage(channelId, sticker);
				},
			};
		},
	);
}
