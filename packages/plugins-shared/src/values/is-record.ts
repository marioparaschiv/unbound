/**
 * @description Tells whether a value Discord passed is a plain object, not `null` or an array. Its fields stay unchecked.
 * @template T The object shape the caller reads, every field of which it still checks.
 * @param value The value.
 * @returns `true` for any non-null object that is not an array.
 */
export function isRecord<T extends object>(value: unknown): value is T {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default isRecord;
