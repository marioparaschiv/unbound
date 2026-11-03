import type { PlayerInfo } from '~/types';

/**
 * @description Picks the player a media viewer source belongs to.
 * @template Target The player type.
 * @param players The mounted players and what each last rendered.
 * @param keys The keys of the source's addresses.
 * @param isVideo Whether the source is a video.
 * @returns The player, or `undefined` when none belongs to the source.
 */
export function pickPlayer<Target>(
	players: Iterable<readonly [Target, PlayerInfo]>,
	keys: readonly string[],
	isVideo: boolean,
): Target | undefined {
	const entries = [...players];
	const matched = entries.find(([, info]) => info.key !== undefined && keys.includes(info.key));

	if (matched) return matched[0];
	if (!isVideo) return;

	const playing = entries.filter(([, info]) => !info.paused);

	if (playing.length === 1) return playing[0]?.[0];
	if (entries.length === 1) return entries[0]?.[0];
}
