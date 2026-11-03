type RowData = {
	message?: { id?: unknown };
};

/**
 * @description Overrides fields of the row options `generateMessageRowData` receives as its second argument.
 * @param args The arguments of the call.
 * @param fields The fields to set.
 * @returns The arguments to generate the row with, unchanged when there are no row options.
 */
export function withRowFields(
	args: readonly unknown[],
	fields: Record<string, unknown>,
): unknown[] {
	const [data, options, ...rest] = args;

	if (!options || typeof options !== 'object') return [...args];

	return [data, { ...options, ...fields }, ...rest];
}

/**
 * @description Reads the id of the message a row is generated for.
 * @param data The first argument of `generateMessageRowData`.
 * @returns The message id, or `undefined` when the row has no message.
 */
export function rowMessageId(data: unknown): string | undefined {
	const id = (data as RowData | undefined)?.message?.id;

	return typeof id === 'string' ? id : undefined;
}
