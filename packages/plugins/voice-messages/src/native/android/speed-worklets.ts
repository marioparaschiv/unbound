import {
	javaFloat,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeUIScope,
} from '@unbound-app/api/native';

const STATE_KEY = '__unboundVoiceMessageSpeed';
const MONO = 1;

type SpeedState = { speed: number };

type PlayEvent = { self: unknown };

function state(): SpeedState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, SpeedState | undefined>;

	return (holder[STATE_KEY] ??= { speed: 1 });
}

/**
 * @description Plays voice messages at the chosen speed. Hooks `AudioTrack.play`, through which Discord's player outputs
 * sound, and sets the playback speed of mono tracks, as voice messages are; video soundtracks are stereo and keep theirs.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param speed The speed to start with.
 */
export function installSpeedHook(scope: NativeUIScope, speed: number) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	state().speed = speed;

	hooks.hook('android.media.AudioTrack', 'play', [], { notify: true }, (event: PlayEvent) => {
		const track = javaReference(event.self as never);
		const { speed: chosen } = state();

		if (!track || chosen === 1) return;

		try {
			if (javaNumber(java.invoke(track, 'getChannelCount', [])) !== MONO) return;

			const params = javaReference(java.invoke(track, 'getPlaybackParams', []));

			if (!params) return;

			java.invoke(params, 'setSpeed', [javaFloat(chosen)]);
			java.invoke(track, 'setPlaybackParams', [params]);
		} catch (error) {
			console.error(`[Voice Messages] Failed to set a track's speed: ${String(error)}`);
		}
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
