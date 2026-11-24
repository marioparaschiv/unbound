export type ItemSize = (section: number, index: number) => number;

type ListData = {
	itemSize: ItemSize;
};

/**
 * @description Grows the Messages row by one item, so the server list's drag and selection math counts the Read All button drawn under it.
 * @template T The list data Discord's server list hook returns.
 * @param data The list data.
 * @param section The Messages section's index.
 * @param sized The item-size functions already wrapped, by Discord's original.
 * @returns The list data with that row twice its height.
 */
export function withReadAllRow<T extends ListData>(
	data: T,
	section: number,
	sized: WeakMap<ItemSize, ItemSize>,
): T {
	const original = data.itemSize;
	let itemSize = sized.get(original);

	if (!itemSize) {
		itemSize = (at, index) => (at === section ? original(at, index) * 2 : original(at, index));
		sized.set(original, itemSize);
	}

	return { ...data, itemSize };
}
