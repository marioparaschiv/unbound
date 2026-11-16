import { resolve } from 'node:path';

/**
 * @description Keeps the addons a build names by manifest id or directory, or every addon when it names none.
 * @template T The addon type.
 * @param addons Every addon in the workspace.
 * @param names The ids or directories to keep.
 * @returns The named addons, in workspace order.
 */
export function namedAddons<T extends { id: string; dir: string }>(
	addons: readonly T[],
	names: readonly string[],
): T[] {
	if (names.length === 0) {
		return [...addons];
	}

	const directories = new Set(names.map((name) => resolve(name)));
	const ids = new Set(names);

	return addons.filter((addon) => ids.has(addon.id) || directories.has(resolve(addon.dir)));
}

/**
 * @description Lists the names that match no addon, so a typo fails instead of building nothing.
 * @template T The addon type.
 * @param addons Every addon in the workspace.
 * @param names The ids or directories asked for.
 * @returns The names no addon has.
 */
export function unknownAddonNames<T extends { id: string; dir: string }>(
	addons: readonly T[],
	names: readonly string[],
): string[] {
	return names.filter((name) => namedAddons(addons, [name]).length === 0);
}

export default { namedAddons, unknownAddonNames };
