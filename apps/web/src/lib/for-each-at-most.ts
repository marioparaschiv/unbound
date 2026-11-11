/**
 * @description Runs `fn` over every item with at most `limit` calls in flight, such as GitHub reads under its concurrency limit.
 * @template T The item type.
 * @param items The items.
 * @param limit The most calls in flight at once.
 * @param fn The work for one item; the first rejection rejects the whole run.
 */
export async function forEachAtMost<T>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	const queue = items.values();

	async function worker() {
		for (const item of queue) {
			await fn(item);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default forEachAtMost;
