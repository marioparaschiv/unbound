/**
 * @description Runs lookups in order and returns the first value one produces, so a lookup can fall back to the name an older or newer Discord build uses.
 * @template T The value the lookups produce.
 * @param attempts The lookups to try. One that throws or returns `null` or `undefined` falls through to the next.
 * @returns The first value a lookup produces, or `undefined` when none does.
 */
function firstOf<T>(...attempts: Array<() => T | null | undefined>): T | undefined {
	for (const attempt of attempts) {
		try {
			const value = attempt();

			if (value !== null && value !== undefined) {
				return value;
			}
		} catch {
			continue;
		}
	}

	return undefined;
}

export default firstOf;
