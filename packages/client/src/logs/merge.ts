import type { UnboundLogEntry } from '@unbound-app/types';

/** How many lines the Logs page keeps; older ones drop off. */
export const LOG_LIMIT = 500;

/**
 * @description Merges lists of entries into one ordered by time, keeping only the newest `limit`.
 * @template T The entry type.
 * @param lists Lists of entries, each already in time order.
 * @param limit How many of the newest entries to keep.
 * @returns The merged entries, oldest first; entries with equal times keep their list order.
 */
export function mergeLogEntries<T extends UnboundLogEntry>(
	lists: T[][],
	limit: number = LOG_LIMIT,
): T[] {
	return lists
		.flat()
		.sort((a, b) => a.t - b.t)
		.slice(-limit);
}

/**
 * @description Appends a batch of live entries, dropping the oldest past `limit`.
 * @template T The entry type.
 * @param entries The entries shown so far.
 * @param batch The new entries, in arrival order.
 * @param limit How many entries to keep.
 * @returns The new list; `entries` when the batch is empty.
 */
export function appendLogEntries<T extends UnboundLogEntry>(
	entries: T[],
	batch: T[],
	limit: number = LOG_LIMIT,
): T[] {
	if (!batch.length) {
		return entries;
	}

	return [...entries, ...batch].slice(-limit);
}
