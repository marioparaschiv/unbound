/**
 * @description Keeps the last item per key, since one `ON CONFLICT DO UPDATE` statement cannot touch a row twice.
 * @template T The feed item type.
 * @param items The page's items, in cursor order.
 * @param key Derives the row key of an item.
 * @returns The items with earlier duplicates dropped.
 */
function dedupe<T>(items: T[], key: (item: T) => string): T[] {
	const latest = new Map<string, T>();

	for (const item of items) {
		latest.set(key(item), item);
	}

	return [...latest.values()];
}

export default dedupe;
