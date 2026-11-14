/** A chat row, as far as the check reads it. */
export type ChatRow = { type?: unknown; message?: { id?: unknown } | null };

/**
 * @description Lists the messages a chat's rows show more than once, as a broken row rebuild leaves them.
 * @param rows The rows Discord holds for the open chat.
 * @returns Each duplicated message id, once.
 */
export function duplicatedMessages(rows: readonly ChatRow[]): string[] {
	const seen = new Set<string>();
	const duplicated = new Set<string>();

	for (const row of rows) {
		const id = row.message?.id;

		if (typeof id !== 'string') continue;
		if (seen.has(id)) duplicated.add(id);

		seen.add(id);
	}

	return [...duplicated];
}

export default duplicatedMessages;
