export type Shard = { index: number; count: number };

/**
 * @description Reads a shard such as `2/3`.
 * @param value The shard, as `index/count`.
 * @returns The shard, or `undefined` for anything else, such as `0/3` or `4/3`.
 */
export function parseShard(value: string | undefined): Shard | undefined {
	const match = value ? /^(\d+)\/(\d+)$/.exec(value.trim()) : null;
	const index = match ? Number(match[1]) : 0;
	const count = match ? Number(match[2]) : 0;

	return index >= 1 && index <= count ? { index, count } : undefined;
}

/**
 * @description Keeps the items that belong to a shard, dealt round-robin so every shard gets a similar mix.
 * @template T The item type.
 * @param items Every item, in a stable order.
 * @param shard The shard to keep; without one, every item.
 * @returns The shard's items.
 */
export function inShard<T>(items: readonly T[], shard: Shard | undefined): T[] {
	return shard
		? items.filter((_, position) => position % shard.count === shard.index - 1)
		: [...items];
}
