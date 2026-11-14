import { metro } from '@unbound-app/api';
import { Platform } from 'react-native';

type Sound = {
	ensureSound(): Promise<{ _duration?: number } | undefined>;
	play(): Promise<void> | void;
	stop(): void;
	destroyAudio?(): void;
};

type SoundClass = new (url: string, name: string, volume: number, usage: string) => Sound;

const VOLUME = 0.5;
const SOUND_NAME = 'vibing_wumpus';

let current: { url: string; sound: Sound; timer?: ReturnType<typeof setTimeout> } | undefined;

function durationMs(seconds: number | undefined): number {
	if (!seconds) return 0;

	return Platform.OS === 'ios' ? seconds * 1000 : seconds;
}

/**
 * @description Stops the preview that is playing, if any.
 */
export function stopPreview(): void {
	if (!current) return;

	clearTimeout(current.timer);
	current.sound.stop();
	current.sound.destroyAudio?.();
	current = undefined;
}

/**
 * @description Plays a preview clip with Discord's own audio player, stopping the one before.
 * @param url The clip.
 * @param onEnd Called when the clip finishes or fails to load.
 * @throws When Discord's audio player is unavailable.
 */
export async function playPreview(url: string, onEnd: () => void): Promise<void> {
	const MobileAudioSound: SoundClass | undefined =
		metro.findByProps('MobileAudioSound')?.MobileAudioSound;

	if (!MobileAudioSound) throw new Error("Discord's audio player is unavailable.");

	stopPreview();

	const sound = new MobileAudioSound(url, SOUND_NAME, VOLUME, 'default');
	const playing = { url, sound };

	current = playing;

	const duration = durationMs((await sound.ensureSound())?._duration);

	if (current !== playing) return;

	if (!duration) {
		stopPreview();
		onEnd();

		return;
	}

	await sound.play();
	current.timer = setTimeout(() => {
		if (current?.sound === sound) stopPreview();
		onEnd();
	}, duration);
}
