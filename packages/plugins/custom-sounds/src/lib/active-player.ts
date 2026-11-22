import type { LinkPlayer } from '@unbound-plugins/shared/media/link-player';

export type PlayableSound = (name: string) => boolean;

let current: LinkPlayer | undefined;
let currentPlayable: PlayableSound | undefined;

/**
 * @description Remembers the running plugin's player and sound check, so the settings preview plays the same way.
 * @param player The player, or `undefined` once the plugin stops.
 * @param playable Whether Discord can play one of its sounds, or `undefined` once the plugin stops.
 */
export function setActivePlayer(player: LinkPlayer | undefined, playable?: PlayableSound): void {
	current = player;
	currentPlayable = playable;
}

/**
 * @description Reads the running plugin's player.
 * @returns The player, or `undefined` while the plugin is stopped.
 */
export function activePlayer(): LinkPlayer | undefined {
	return current;
}

/**
 * @description Reads the running plugin's check for which of Discord's sounds play.
 * @returns The check, or `undefined` while the plugin is stopped.
 */
export function activePlayable(): PlayableSound | undefined {
	return currentPlayable;
}

export default { setActivePlayer, activePlayer, activePlayable };
