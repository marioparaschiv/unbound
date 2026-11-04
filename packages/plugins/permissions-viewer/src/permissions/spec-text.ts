export type MessageFormatter = (message: unknown) => string | undefined;

/**
 * @description Reads a title or description from Discord's permission spec, which holds plain text or a localised message.
 * @param value The spec's `title` or `description`.
 * @param format Formats a localised message.
 * @returns The text, or `undefined` when there is none.
 */
export function resolveSpecText(value: unknown, format: MessageFormatter): string | undefined {
	if (typeof value === 'string') return value || undefined;

	if (value === null || value === undefined) return undefined;

	if (typeof value !== 'function' && typeof value !== 'object') return undefined;

	const text = format(value);

	return typeof text === 'string' && text ? text : undefined;
}
