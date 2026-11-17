import type { LinkPlayer } from '@unbound-plugins/shared/media/link-player';
import { rememberSound } from '@unbound-plugins/shared/media/sound-download';
import { settings } from '@unbound-app/settings';

import { speakWav, spokenLetters, voiceFor, type VoiceName } from '~/lib/voice';

export type Speaker = { speak(text: string, userId: string): Promise<void>; stop(): void };

/**
 * @description Speaks messages in Animalese through the shared player, one at a time, keeping the chosen quiet time
 * between them and skipping messages that arrive while one is playing.
 * @param player The shared link player, which plays the generated sound from the sound cache.
 * @param now The clock, in milliseconds.
 * @returns The speaker.
 */
export function createSpeaker(player: LinkPlayer, now: () => number = Date.now): Speaker {
	let busyUntil = 0;
	let current: number | undefined;
	let next = 0;

	return {
		async speak(text, userId) {
			const at = now();

			if (at < busyUntil) return;

			const letters = spokenLetters(text, settings.maxLetters);

			if (!letters.length) return;

			const voice: VoiceName =
				settings.voice === 'person' ? voiceFor(userId) : settings.voice;
			const key = `unbound-animalese:${next++}`;

			busyUntil = at + letters.length * settings.speed + settings.cooldown;
			rememberSound(key, speakWav(letters, voice, settings.speed));
			current = await player.play(key, { volume: settings.volume, loop: false });
		},
		stop() {
			if (current !== undefined) player.stop(current);

			current = undefined;
			busyUntil = 0;
		},
	};
}
