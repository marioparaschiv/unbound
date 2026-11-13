export type PickerSticker = { id?: string };

export type StickerCategory = { type?: string; stickers?: PickerSticker[] };

/**
 * @description Takes the stickers the user cannot send out of the sticker picker's sections, and drops a server section
 * left empty.
 * @param categories The sections Discord built.
 * @param sendable Whether the user can send a sticker in the current channel.
 * @returns The sections to show; the same array when nothing was unusable.
 */
export function usableStickerCategories<C extends StickerCategory>(
	categories: C[],
	sendable: (sticker: PickerSticker) => boolean,
): C[] {
	let changed = false;
	const usable = categories.flatMap((category) => {
		if (!category.stickers) return [category];

		const stickers = category.stickers.filter(sendable);

		if (stickers.length === category.stickers.length) return [category];

		changed = true;

		return stickers.length || category.type !== 'GUILD' ? [{ ...category, stickers }] : [];
	});

	return changed ? usable : categories;
}
