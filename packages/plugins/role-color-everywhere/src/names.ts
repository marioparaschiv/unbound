export type NameOwner<T> = [names: string[], owner: T];

/**
 * @description Keeps the names a user is shown by, dropping missing and empty ones.
 * @param names Candidate names, such as a nickname, global name and username.
 * @returns The non-empty names in order.
 */
export function presentNames(...names: (string | null | undefined)[]): string[] {
	return names.filter((name): name is string => !!name);
}

/**
 * @description Maps each name to the one owner shown by it, leaving out names two owners share so a name is never colored for the wrong person.
 * @template T The owner, such as a user ID or a role appearance.
 * @param owners Each owner with the names it is shown by.
 * @returns The names that belong to exactly one owner.
 */
export function uniqueNames<T>(owners: NameOwner<T>[]): Map<string, T> {
	const result = new Map<string, T>();
	const shared = new Set<string>();

	for (const [names, owner] of owners) {
		for (const name of new Set(names)) {
			if (shared.has(name)) {
				continue;
			}

			if (result.has(name)) {
				result.delete(name);
				shared.add(name);
			} else {
				result.set(name, owner);
			}
		}
	}

	return result;
}

export default { presentNames, uniqueNames };
