const tracked = new Map<ReadonlySet<unknown>, string>();

/** How many hooks one owner holds through its native scopes. */
export type HookOwner = { owner: string; hooks: number };

/**
 * @description Counts a native scope's hooks under its owner, so a pile of hooks can be traced to the plugin holding them.
 * @param owner The plugin or tool that owns the scope.
 * @param sets The scope's live hook token sets.
 * @returns A function that stops counting them, for when the scope is disposed.
 */
export function trackHookOwner(owner: string, ...sets: ReadonlySet<unknown>[]): () => void {
	for (const set of sets) tracked.set(set, owner);

	return () => {
		for (const set of sets) tracked.delete(set);
	};
}

/**
 * @description Lists the owners holding hooks through native scopes, most first.
 * @returns Each owner with its live hook count; owners with none are left out.
 */
export function hookOwners(): HookOwner[] {
	const counts = new Map<string, number>();

	for (const [set, owner] of tracked) counts.set(owner, (counts.get(owner) ?? 0) + set.size);

	return [...counts]
		.filter(([, hooks]) => hooks > 0)
		.map(([owner, hooks]) => ({ owner, hooks }))
		.sort((left, right) => right.hooks - left.hooks);
}
