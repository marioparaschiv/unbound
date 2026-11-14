import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { isAudioAttachment } from '@unbound-plugins/shared/media/audio-attachment';
import { playerURL } from '@unbound-plugins/shared/native/ios/player-url';

import { MIX_WITH_OTHERS, PLAYBACK, stopsInBackground } from '~/lib/session';

const STATE_KEY = '__unboundBackgroundVoiceMessages';

type Category = { category: string; options: number };

type BackgroundState = { previous?: Category; player?: NativeObjectHandle };

function state(): BackgroundState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, BackgroundState | undefined>;

	return (holder[STATE_KEY] ??= {});
}

function audioSession(objc: NativeObjCBridge): NativeObjectHandle {
	'worklet';

	return objc.call(objc.getClass('AVAudioSession')!, 'sharedInstance') as NativeObjectHandle;
}

function setCategory(objc: NativeObjCBridge, { category, options }: Category) {
	'worklet';
	objc.invoke(audioSession(objc), 'setCategory:withOptions:error:', [category, options, null]);
}

function keepPlaying(objc: NativeObjCBridge, player: NativeObjectHandle) {
	'worklet';
	const current = state();
	const session = audioSession(objc);
	const category = String(objc.invoke(session, 'category', []));

	current.player = player;

	if (current.previous || !stopsInBackground(category)) return;

	current.previous = { category, options: Number(objc.invoke(session, 'categoryOptions', [])) };
	setCategory(objc, { category: PLAYBACK, options: MIX_WITH_OTHERS });
}

function restore(objc: NativeObjCBridge) {
	'worklet';
	const current = state();

	if (current.previous) setCategory(objc, current.previous);

	current.previous = undefined;
	current.player = undefined;
}

/**
 * @description Keeps audio attachments playing once Discord leaves the screen. Discord's audio session is ambient, so
 * iOS suspends the app, and its audio, as soon as it is backgrounded. Hooks `-[AVPlayer setRate:]`: while a voice
 * message or audio file plays the session moves to `Playback`, mixing with other audio as before, and a pause puts the
 * old category back. Calls keep their `PlayAndRecord` session untouched.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 */
export function installBackgroundPlayback(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	objc.hook('AVPlayer', 'setRate:', {
		after: ({ self, args }) => {
			try {
				if (!isAudioAttachment(playerURL(objc, self))) return;

				if (Number(args[0]) > 0) keepPlaying(objc, self);
				else restore(objc);
			} catch (error) {
				console.error(
					`[Background Voice Messages] Failed to update the audio session: ${String(error)}`,
				);
			}
		},
	});
}

/**
 * @description Puts the old audio session category back once the tracked player has stopped on its own, which a clip
 * reaching its end does without calling `setRate:`.
 * @param scope The plugin's UI scope.
 */
export function restoreWhenIdle(scope: NativeUIScope) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const { player, previous } = state();

	if (!previous) return;
	if (player && Number(objc.invoke(player, 'rate', [])) > 0) return;

	restore(objc);
}

/**
 * @description Puts the old audio session category back, for when the plugin stops.
 * @param scope The plugin's UI scope.
 */
export function restoreSession(scope: NativeUIScope) {
	'worklet';
	restore(scope.objc as NativeObjCBridge);
}
