import { linkPlayer, type LinkPlayer } from '@unbound-plugins/shared/media/link-player';
import type { PluginContext } from '@unbound-app/api/native';

let player: LinkPlayer | undefined;

/**
 * @description Creates the player that plays pronunciations.
 * @param context The plugin's native bridge and temporary folder.
 */
export function startPlayer(context: PluginContext): void {
	player = linkPlayer(context.native, context.tempPath) ?? undefined;
}

/**
 * @description Releases the pronunciation player.
 */
export function stopPlayer(): void {
	player?.dispose();
	player = undefined;
}

/**
 * @description Plays the first of a word's recordings that downloads.
 * @param urls The recordings' links, best first.
 * @returns Whether one started playing.
 */
export async function playPronunciation(urls: string[]): Promise<boolean> {
	for (const url of urls) {
		if ((await player?.play(url, { volume: 1, loop: false })) !== undefined) return true;
	}

	return false;
}

export default { startPlayer, stopPlayer, playPronunciation };
