import type { LinkPlayer } from '@unbound-plugins/shared/media/link-player';

let current: LinkPlayer | undefined;

/**
 * @description Remembers the running plugin's player, so the settings preview plays links too.
 * @param player The player, or `undefined` once the plugin stops.
 */
export function setActivePlayer(player: LinkPlayer | undefined): void {
	current = player;
}

/**
 * @description Reads the running plugin's player.
 * @returns The player, or `undefined` while the plugin is stopped.
 */
export function activePlayer(): LinkPlayer | undefined {
	return current;
}

export default { setActivePlayer, activePlayer };
