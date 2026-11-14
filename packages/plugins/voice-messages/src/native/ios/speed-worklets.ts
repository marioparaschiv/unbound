import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { isAudioAttachment } from '~/lib/speed';

const STATE_KEY = '__unboundVoiceMessageSpeed';

type SpeedState = { speed: number; applying: boolean };

function state(): SpeedState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, SpeedState | undefined>;

	return (holder[STATE_KEY] ??= { speed: 1, applying: false });
}

function itemURL(objc: NativeObjCBridge, player: NativeObjectHandle): string {
	'worklet';
	const item = objc.invoke(player, 'currentItem', []) as NativeObjectHandle | null;
	const asset = item && (objc.invoke(item, 'asset', []) as NativeObjectHandle | null);

	if (!asset || objc.className(asset) !== 'AVURLAsset') return '';

	const url = objc.invoke(asset, 'URL', []) as NativeObjectHandle | null;

	return url ? String(objc.invoke(url, 'absoluteString', [])) : '';
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
				if (!isAudioAttachment(itemURL(objc, self))) return result;

				current.applying = true;
				objc.invoke(self, 'setRate:', [current.speed]);
			} catch (error) {
				console.error(`[Voice Messages] Failed to speed up a player: ${String(error)}`);
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
