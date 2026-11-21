/**
 * @description Runs a task for every item with at most `limit` running at once, keeping each result in its item's place.
 * @template T The item type.
 * @template R The result type.
 * @param items The items.
 * @param limit How many tasks run at once.
 * @param task The work for one item.
 * @returns The results, in item order.
 */
export async function runLimited<T, R>(
	items: readonly T[],
	limit: number,
	task: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = [];
	let next = 0;

	async function worker() {
		while (next < items.length) {
			const index = next++;

			results[index] = await task(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

	return results;
}

export default runLimited;
