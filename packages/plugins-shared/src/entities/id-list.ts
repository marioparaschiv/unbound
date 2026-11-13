/**
 * @description Reads a stored list of ids, separated by commas, spaces or new lines, such as an {@link EntityList}'s setting.
 * @param value The stored setting.
 * @returns The unique ids, in stored order, or none when the setting is not a string.
 */
export function parseIdList(
	// UNKNOWN: the store returns whatever was saved under the key, which may not be a string.
	value: unknown,
): string[] {
	if (typeof value !== 'string') {
		return [];
	}

	return [...new Set(value.split(/[\s,]+/).filter(Boolean))];
}

/**
 * @description Writes ids in the format {@link parseIdList} reads.
 * @param ids The ids, in order.
 * @returns The unique, trimmed ids, separated by commas.
 */
export function formatIdList(ids: string[]): string {
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].join(', ');
}

export default { parseIdList, formatIdList };
