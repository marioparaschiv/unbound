import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { isAudioAttachment } from '@unbound-plugins/shared/media/audio-attachment';
import { playerURL } from '@unbound-plugins/shared/native/ios/player-url';

const STATE_KEY = '__unboundVoiceMessageSpeed';

type SpeedState = { speed: number; applying: boolean };

function state(): SpeedState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, SpeedState | undefined>;

	return (holder[STATE_KEY] ??= { speed: 1, applying: false });
}

/**
 * @description Plays voice messages and audio files at the chosen speed. Hooks `-[AVPlayer setRate:]`, which `play` calls
 * with 1, and sets the speed right after for players of an audio attachment; videos keep their rate. A rate passed on to
 * the original call does not stick, so the speed is set again through the hook, which lets that call through.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param speed The speed to start with.
 */
export function installSpeedHook(scope: NativeUIScope, speed: number) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	state().speed = speed;

	objc.hook('AVPlayer', 'setRate:', {
		replace: ({ self, args, original }) => {
			const current = state();
			const result = original(...args);

			if (Number(args[0]) !== 1 || current.speed === 1 || current.applying) return result;

			try {
				if (!isAudioAttachment(playerURL(objc, self))) return result;

				current.applying = true;
				objc.invoke(self, 'setRate:', [current.speed]);
			} catch (error) {
				console.error(
					`[Voice Message Tools] Failed to speed up a player: ${String(error)}`,
				);
			} finally {
				current.applying = false;
			}

			return result;
		},
	});
}

/**
 * @description Sets the speed the next playback uses.
 * @param speed The speed, 1 for normal.
 */
export function setSpeed(speed: number) {
	'worklet';
	state().speed = speed;
}
