export type PickerEmoji = { id?: string; name?: string };

export type EmojiCategory = {
	type?: string;
	isNitroLocked?: boolean;
	emojis?: PickerEmoji[];
	emojisDisabled?: ReadonlySet<string>;
};

/**
 * @description Takes the emojis the user cannot send out of the picker's sections: Nitro-locked server sections go, disabled
 * emojis leave every other section, and a server section left empty goes too.
 * @param categories The sections Discord built.
 * @returns The sections to show; the same array when nothing was unusable.
 */
export function usableCategories<C extends EmojiCategory>(categories: C[]): C[] {
	let changed = false;
	const usable = categories.flatMap((category) => {
		if (category.isNitroLocked) {
			changed = true;

			return [];
		}

		const disabled = category.emojisDisabled;

		if (!disabled?.size || !category.emojis) return [category];

		const emojis = category.emojis.filter((emoji) => !emoji.id || !disabled.has(emoji.id));

		changed = true;

		return emojis.length || category.type !== 'GUILD' ? [{ ...category, emojis }] : [];
	});

	return changed ? usable : categories;
}

export default { usableCategories };
