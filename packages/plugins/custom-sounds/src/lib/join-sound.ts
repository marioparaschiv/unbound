import { settings } from '@unbound-app/settings';
import { metro } from '@unbound-app/api';

import type { LinkPlayer } from '@unbound-plugins/shared/media/link-player';
import type { PlayableSound } from '~/lib/active-player';

type SoundPlayer = { playSound(name: string, volume: number): void };

const Sounds: SoundPlayer | undefined = metro.findByProps('createSoundForPack', 'playSound', {
	lazy: true,
});

/**
 * @description Plays the join sound only on this device: one of Discord's, each one Discord ships on both iOS and
 * Android since a missing one crashes Discord on Android, or the file from the chosen link.
 * @param player Plays files from links.
 * @param playable Whether Discord can play the chosen sound on this device.
 */
export function playJoinSound(
	player: LinkPlayer | undefined,
	playable: PlayableSound = () => true,
): void {
	const volume = settings.volume / 100;

	try {
		if (settings.sound === 'link') {
			if (settings.joinLink) void player?.play(settings.joinLink, { volume, loop: false });

			return;
		}

		if (!playable(settings.sound)) {
			logger.warn(
				`Skipped join sound ${settings.sound}: Discord cannot play it on this device.`,
			);

			return;
		}

		Sounds?.playSound(settings.sound, volume);
	} catch (error) {
		logger.error(`Failed to play join sound ${settings.sound}:`, error);
	}
}

export default { playJoinSound };
