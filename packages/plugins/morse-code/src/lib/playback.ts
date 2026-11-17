import type { LinkPlayer } from '@unbound-plugins/shared/media/link-player';
import { rememberSound } from '@unbound-plugins/shared/media/sound-download';
import { settings } from '@unbound-app/settings';
import { Vibration } from 'react-native';

import { morseTimings, morseWav, unitFor } from '~/lib/morse';

export type MorsePlayer = { play(code: string): Promise<void>; stop(): void };

/**
 * @description Plays Morse code as a tone, a vibration pattern or both, at the chosen speed.
 * @param sounds The shared player, which plays the generated tone from the sound cache.
 * @returns The player.
 */
export function createMorsePlayer(sounds: LinkPlayer): MorsePlayer {
	let playing: number | undefined;
	let next = 0;

	function stop() {
		Vibration.cancel();

		if (playing !== undefined) sounds.stop(playing);

		playing = undefined;
	}

	return {
		async play(code: string) {
			stop();

			const timings = morseTimings(code, unitFor(settings.speed));

			if (timings.length === 0) return;

			if (settings.playback !== 'sound') Vibration.vibrate(timings);

			if (settings.playback !== 'vibration') {
				const key = `unbound-morse:${next++}`;

				rememberSound(key, morseWav(timings));
				playing = await sounds.play(key, { volume: 1, loop: false });
			}
		},
		stop,
	};
}
