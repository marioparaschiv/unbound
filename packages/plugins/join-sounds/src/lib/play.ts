import { settings } from '@unbound-app/settings';
import { metro } from '@unbound-app/api';

type SoundPlayer = { playSound(name: string, volume: number): void };

const Sounds: SoundPlayer | undefined = metro.findByProps('createSoundForPack', 'playSound', {
	lazy: true,
});

/**
 * @description Plays the chosen sound through Discord's own sound player, only on this device. Every option is one
 * Discord ships on both iOS and Android; a missing one would crash Discord on Android.
 */
export function playJoinSound(): void {
	try {
		Sounds?.playSound(settings.sound, settings.volume / 100);
	} catch (error) {
		logger.error(`Failed to play join sound ${settings.sound}:`, error);
	}
}
