import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { usableCategories, type EmojiCategory } from '~/lib/categories';
import { usableStickerCategories, type StickerCategory, type PickerSticker } from '~/lib/stickers';

type PickerUtils = { useEmojiCategories(...args: unknown[]): EmojiCategory[] };

type StickerUtils = { useStickerCategories(channel: unknown): StickerCategory[] };

type Sendability = {
	StickerSendability: { SENDABLE: number };
	getStickerSendability(sticker: PickerSticker, user: unknown, channel: unknown): number;
};

/**
 * @description Leaves the emojis you cannot send out of the emoji picker. Patches `useEmojiCategories`, which builds the picker's
 * sections with Discord's own locked and disabled marks.
 */
export function patchEmojiPicker(): void {
	if (!settings.emojis) return;

	const PickerUtils = metro.findByFilePath('modules/emoji_picker/EmojiPickerUtils.tsx') as
		| PickerUtils
		| undefined;

	if (!PickerUtils?.useEmojiCategories) {
		logger.warn('Hide unusable emojis skipped: Discord moved useEmojiCategories.');

		return;
	}

	patcher.after(PickerUtils, 'useEmojiCategories', ({ result }) =>
		Array.isArray(result) ? usableCategories(result) : result,
	);
}

/**
 * @description Leaves the stickers you cannot send in the current channel out of the sticker picker. Patches
 * `useStickerCategories`, and asks Discord's `getStickerSendability` about each sticker.
 */
export function patchStickerPicker(): void {
	if (!settings.stickers) return;

	const StickerUtils = metro.findByProps('useStickerCategories', 'openStickerPickerToPackId') as
		| StickerUtils
		| undefined;
	const Sendability = metro.findByFilePath('modules/stickers/StickerSendability.tsx') as
		| Sendability
		| undefined;

	if (!StickerUtils?.useStickerCategories || !Sendability?.getStickerSendability) {
		logger.warn('Hide unusable stickers skipped: Discord moved useStickerCategories.');

		return;
	}

	const UserStore = flux.getStore('User');

	patcher.after(StickerUtils, 'useStickerCategories', ({ args: [channel], result }) => {
		if (!Array.isArray(result)) return result;

		const user = UserStore.getCurrentUser();

		return usableStickerCategories(
			result,
			(sticker) =>
				Sendability.getStickerSendability(sticker, user, channel) ===
				Sendability.StickerSendability.SENDABLE,
		);
	});
}
