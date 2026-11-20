/** The roles one member update added and removed. */
export type RoleChanges = { gained: string[]; lost: string[] };

/**
 * @description Compares a member's roles before and after an update.
 * @param before The role ids before.
 * @param after The role ids after.
 * @returns The roles added and the roles removed, in the order each list holds them.
 */
export function roleChanges(before: readonly string[], after: readonly string[]): RoleChanges {
	const had = new Set(before);
	const has = new Set(after);

	return {
		gained: after.filter((id) => !had.has(id)),
		lost: before.filter((id) => !has.has(id)),
	};
}
