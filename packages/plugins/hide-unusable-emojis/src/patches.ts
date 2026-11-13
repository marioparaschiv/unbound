import { metro, patcher } from '@unbound-app/api';

import { usableCategories, type EmojiCategory } from '~/lib/categories';

type PickerUtils = { useEmojiCategories(...args: unknown[]): EmojiCategory[] };

/**
 * @description Leaves the emojis you cannot send out of the emoji picker. Patches `useEmojiCategories`, which builds the picker's
 * sections with Discord's own locked and disabled marks.
 */
export function patchEmojiPicker(): void {
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

export default { patchEmojiPicker };
