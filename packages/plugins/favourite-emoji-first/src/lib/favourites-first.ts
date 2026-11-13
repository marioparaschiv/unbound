/**
 * @description Moves favourites to the front, keeping each group in its original order, then keeps the first `limit`.
 * @template T The kind of item being sorted.
 * @param items The items in their original order.
 * @param isFavourite Whether an item is a favourite.
 * @param limit How many items to keep.
 * @returns The favourites first, cut to `limit`.
 */
export function favouritesFirst<T>(
	items: T[],
	isFavourite: (item: T) => boolean,
	limit: number,
): T[] {
	const favourites = items.filter(isFavourite);
	const others = items.filter((item) => !isFavourite(item));

	return [...favourites, ...others].slice(0, limit);
}
