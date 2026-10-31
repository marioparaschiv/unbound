// The plugins manager installs the check on initialize; until then every owner counts as known.
let check: (owner: string) => boolean = () => true;

/**
 * @description Sets how commands tell a plugin id from a mistyped owner, so the plugins manager supplies it without the commands API importing it.
 * @param ownerCheck Returns whether a plugin with that id is loaded.
 */
export function setOwnerCheck(ownerCheck: (owner: string) => boolean): void {
	check = ownerCheck;
}

/**
 * @description Whether a commands owner names a loaded plugin.
 * @param owner The owner id passed to `createCommands`.
 * @returns `true` when a plugin with that id is loaded, or before the plugins manager has started.
 */
export function isKnownOwner(owner: string): boolean {
	return check(owner);
}

export default { setOwnerCheck, isKnownOwner };
