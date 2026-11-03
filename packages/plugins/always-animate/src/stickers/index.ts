import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { combineCleanups, forceResult, forceRowFields, forceUserSetting } from '~/force/patches';
import { ALWAYS_ANIMATE_STICKERS, STICKERS_UTILS_PATH } from '~/constants';

/**
 * @description Plays animated stickers on a loop instead of only when tapped.
 * Makes Discord's `AnimateStickers` user setting read as always, makes `shouldAnimateSticker` of `modules/stickers/StickersUtils.tsx` return `true`,
 * and marks each chat row's own message as the animating sticker message in the options of `generateMessageRowData`.
 * @returns A function that removes the patches.
 */
export function animateStickers(): () => void {
	return combineCleanups([
		forceUserSetting('AnimateStickers', ALWAYS_ANIMATE_STICKERS),
		whenLoaded<AnyProps>(STICKERS_UTILS_PATH, (module) =>
			forceResult(module, 'shouldAnimateSticker', true),
		),
		forceRowFields((messageId) => (messageId ? { animatingStickerMessageId: messageId } : {})),
	]);
}
