import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import {
	combineCleanups,
	forceResult,
	forceRowFields,
	forceUserSetting,
	onPathLoaded,
} from '~/patches/force';
import { ALWAYS_ANIMATE_STICKERS, STICKERS_UTILS_PATH } from '~/lib/constants';

function enable(): () => void {
	return combineCleanups([
		forceUserSetting('AnimateStickers', ALWAYS_ANIMATE_STICKERS),
		onPathLoaded(STICKERS_UTILS_PATH, (module) =>
			forceResult(module, 'shouldAnimateSticker', true),
		),
		forceRowFields((messageId) => (messageId ? { animatingStickerMessageId: messageId } : {})),
	]);
}

/**
 * @description Plays animated stickers on a loop instead of only when tapped, while the `stickers` setting is on.
 * Makes Discord's `AnimateStickers` user setting read as always, makes `shouldAnimateSticker` of `modules/stickers/StickersUtils.tsx` return `true`,
 * and marks each chat row's own message as the animating sticker message in the options of `generateMessageRowData`.
 */
export function animateStickers(): void {
	whileEnabled('stickers', enable);
}
