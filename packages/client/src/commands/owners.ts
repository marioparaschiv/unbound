const knowsEveryOwner = () => true;

// The plugins manager installs the check on initialize and removes it on shutdown; without it every owner counts as known.
let check: (owner: string) => boolean = knowsEveryOwner;

/**
 * @description Sets how commands tell a plugin id from a mistyped owner, so the plugins manager supplies it without the commands API importing it.
 * @param ownerCheck Returns whether a plugin with that id is loaded, or `undefined` to count every owner as known again.
 */
export function setOwnerCheck(ownerCheck: ((owner: string) => boolean) | undefined): void {
	check = ownerCheck ?? knowsEveryOwner;
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
