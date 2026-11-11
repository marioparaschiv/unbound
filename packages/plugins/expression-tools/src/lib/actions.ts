import { format, messages } from '@unbound-app/i18n';

import { Clipboard, StickerActions, StickerFavorites } from '~/lib/modules';
import { notify, notifyError } from '~/lib/notify';
import type { Sticker } from '~/lib/expression';

/**
 * @description Copies text to the clipboard and confirms it with a toast.
 * @param text The text to copy.
 * @param confirmation The toast shown once it is copied.
 */
export function copyText(text: string, confirmation: string): void {
	void Promise.resolve(Clipboard.setString(text))
		.then(() => notify(confirmation))
		.catch(notifyError);
}

/**
 * @description Tells whether the current user has favorited a sticker.
 * @param sticker The sticker.
 * @returns Whether it is in the user's favorites.
 */
export function isFavoriteSticker(sticker: Sticker): boolean {
	return StickerFavorites?.isFavoriteSticker?.(sticker.id) ?? false;
}

/**
 * @description Adds a sticker to the user's favorites or removes it, then confirms with a toast.
 * @param sticker The sticker.
 * @param favorite `true` to favorite it, `false` to unfavorite it.
 * @returns A promise that settles once Discord saved the change.
 */
export async function setFavoriteSticker(sticker: Sticker, favorite: boolean): Promise<void> {
	if (!StickerActions?.favoriteSticker) {
		throw new Error(messages.FAVORITES_UNAVAILABLE);
	}

	if (favorite) {
		await StickerActions.favoriteSticker(sticker.id);
		notify(format('ADDED_TO_FAVORITES', { name: sticker.name }));
	} else {
		await StickerActions.unfavoriteSticker(sticker.id);
		notify(format('REMOVED_FROM_FAVORITES', { name: sticker.name }));
	}
}

export default { copyText, isFavoriteSticker, setFavoriteSticker };
