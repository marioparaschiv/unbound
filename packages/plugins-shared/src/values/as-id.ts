/**
 * @description Reads a Discord id from a value Discord passed, such as a prop or an action field.
 * @param value The value.
 * @returns The id, or `undefined` for anything but a non-empty string.
 */
// UNKNOWN: props, menu fields and actions come from Discord untyped.
export function asId(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

export default asId;
