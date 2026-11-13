/** Each addon a crash or freeze disabled, with the version it was running then. */
export type CrashHolds = Record<string, string>;

export const CRASH_HOLDS_KEY = 'crashHolds';

/**
 * @description Records that a crash or freeze disabled an addon at its current version.
 * @param holds The holds so far.
 * @param addon The disabled addon.
 * @returns The holds with this one added.
 */
export function holdAddon(holds: CrashHolds, addon: { id: string; version: string }): CrashHolds {
	return { ...holds, [addon.id]: addon.version };
}

/**
 * @description Drops an addon's hold, once it runs again or the user turned it back on.
 * @param holds The holds so far.
 * @param id The addon's id.
 * @returns The holds without it.
 */
export function releaseAddon(holds: CrashHolds, id: string): CrashHolds {
	const { [id]: _released, ...rest } = holds;

	return rest;
}

/**
 * @description Whether an addon a crash or freeze disabled has since updated, so it deserves another chance.
 * @param holds The holds.
 * @param addon The addon, at its version now.
 * @returns Whether it is held and now runs a different version.
 */
export function updatedSinceHold(
	holds: CrashHolds,
	addon: { id: string; version: string },
): boolean {
	const held = holds[addon.id];

	return held !== undefined && held !== addon.version;
}
