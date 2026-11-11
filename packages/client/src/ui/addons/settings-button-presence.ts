/** Whether the button is in the tree, and whether it is animating toward shown. */
export type Presence = { mounted: boolean; shown: boolean };

/**
 * @description Follows the button's visibility: showing mounts it and animates it in; hiding animates it out
 * but keeps it mounted until {@link settlePresence} reports the exit finished.
 * @param presence The current presence.
 * @param visible Whether the button should show.
 * @returns The next presence.
 */
export function nextPresence(presence: Presence, visible: boolean): Presence {
	if (visible) {
		return presence.mounted && presence.shown ? presence : { mounted: true, shown: true };
	}

	return presence.shown ? { mounted: presence.mounted, shown: false } : presence;
}

/**
 * @description Unmounts the button once its exit finished; an exit a re-show interrupted keeps it mounted.
 * @param presence The current presence.
 * @returns The next presence.
 */
export function settlePresence(presence: Presence): Presence {
	return presence.shown || !presence.mounted ? presence : { mounted: false, shown: false };
}
