const NAMED_RELOADS = 2;

/**
 * @description Summarises the plugins that hot reloaded together, so a push of many plugins shows one toast.
 * @param names The reloaded plugins' names, in the order they reloaded.
 * @returns A sentence such as `Reloaded Shiki Codeblocks.` or `Reloaded Moyai, ReviewDB and 10 more.`
 */
export function reloadSummary(names: string[]): string {
	const unique = [...new Set(names)];

	if (unique.length <= NAMED_RELOADS + 1) {
		const last = unique.at(-1);
		const rest = unique.slice(0, -1);

		return `Reloaded ${rest.length ? `${rest.join(', ')} and ${last}` : last}.`;
	}

	const named = unique.slice(0, NAMED_RELOADS).join(', ');

	return `Reloaded ${named} and ${unique.length - NAMED_RELOADS} more.`;
}

export default reloadSummary;
