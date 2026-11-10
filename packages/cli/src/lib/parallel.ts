import { availableParallelism } from 'node:os';

/**
 * @description Runs work over every item, a few at a time, keeping the results in the order of the items.
 * @template T The item type.
 * @template R The result type.
 * @param items The items to work through.
 * @param work The work for one item.
 * @param limit How many items run at once; one per core by default.
 * @returns Each item's result, in the order of `items`.
 */
export async function mapInParallel<T, R>(
	items: readonly T[],
	work: (item: T, index: number) => Promise<R>,
	limit: number = availableParallelism(),
): Promise<R[]> {
	const results: R[] = [];
	let next = 0;

	async function worker() {
		for (let index = next++; index < items.length; index = next++) {
			results[index] = await work(items[index] as T, index);
		}
	}

	await Promise.all(Array.from({ length: Math.min(items.length, limit) }, worker));

	return results;
}

export default mapInParallel;
