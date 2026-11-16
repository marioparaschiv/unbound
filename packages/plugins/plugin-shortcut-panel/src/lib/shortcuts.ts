export type Shortcut =
	| { id: string; kind: 'plugin'; label: string; pluginId: string }
	| { id: string; kind: 'command'; label: string; command: string };

/**
 * @description Reads the pinned shortcut ids from storage, dropping anything malformed or repeated.
 * @param value What storage held.
 * @returns The ids in the order they were pinned.
 */
export function parsePinned(value: unknown): string[] {
	return Array.isArray(value)
		? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
		: [];
}

/**
 * @description Pins a shortcut at the end, or unpins it.
 * @param pinned The pinned ids.
 * @param id The shortcut.
 * @param pin Whether it should be pinned.
 * @returns The new pinned ids.
 */
export function setPinned(pinned: string[], id: string, pin: boolean): string[] {
	const without = pinned.filter((entry) => entry !== id);

	return pin ? [...without, id] : without;
}

/**
 * @description The pinned shortcuts that still exist, in pinned order; a removed plugin or command drops out.
 * @param pinned The pinned ids.
 * @param available Every shortcut that exists now.
 * @returns The shortcuts to show.
 */
export function pinnedShortcuts(pinned: string[], available: Shortcut[]): Shortcut[] {
	const byId = new Map(available.map((shortcut) => [shortcut.id, shortcut]));

	return pinned.flatMap((id) => byId.get(id) ?? []);
}

export default { parsePinned, setPinned, pinnedShortcuts };
