export type MediaRecord = Record<string, unknown>;

type Match = (value: unknown) => string | null;

/**
 * @description Checks whether a value is an object (or array) whose keys can be searched.
 * @param value Any value from a Discord media record.
 * @returns `true` for any non-null object.
 */
export function isRecord(value: unknown): value is MediaRecord {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Searches a media record depth-first for the first value `match` accepts.
 * @param value The record, or a nested value of it.
 * @param match Returns a result for a value it accepts, otherwise `null`.
 * @param maxDepth How many levels below `value` to search.
 * @param priorityKeys Keys searched before the record's own keys, in order.
 * @param depth The current depth.
 * @returns The first accepted result, or `null`.
 */
export function findDeep(
	value: unknown,
	match: Match,
	maxDepth: number,
	priorityKeys: readonly string[] = [],
	depth: number = 0,
): string | null {
	if (depth > maxDepth) return null;

	const matched = match(value);

	if (matched || !isRecord(value)) return matched;

	for (const key of [...priorityKeys, ...Object.keys(value)]) {
		const found = findDeep(value[key], match, maxDepth, priorityKeys, depth + 1);

		if (found) return found;
	}

	return null;
}
