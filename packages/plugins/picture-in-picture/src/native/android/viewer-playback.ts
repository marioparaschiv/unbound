import { metro } from '@unbound-app/api';
import { NativeEventEmitter, NativeModules } from 'react-native';

import { PLAYER_PROGRESS_EVENT, PROGRESS_FRESH_MS, VIDEO_CONTROLS_PATH } from '~/lib/constants';

type Progress = { time?: unknown; duration?: unknown };

type VideoControls = {
	seek?: (seconds: number) => void;
	pause?: (paused: boolean) => void;
};

type VideoStateStore = {
	getState(): { controls?: VideoControls; paused?: boolean };
};

export type ViewerPlayback = {
	position(): number | undefined;
	isPaused(): boolean;
	pause(): void;
	resume(seconds: number, play: boolean): void;
	dispose(): void;
};

function videoControls(
	VideoControlsModule: { module?: unknown } | undefined,
): ReturnType<VideoStateStore['getState']> | undefined {
	const store = (
		VideoControlsModule?.module as { useVideoStateStore?: VideoStateStore } | undefined
	)?.useVideoStateStore;

	return typeof store?.getState === 'function' ? store.getState() : undefined;
}

/**
 * @description Follows the media viewer's native video player on Android: where it is, from the progress events Discord's `MediaPlayerManager` emits, and its pause and seek controls.
 * @returns The viewer's playback, with a `dispose` that stops listening.
 */
export function createViewerPlayback(): ViewerPlayback {
	// Without the module the viewer cannot pause or seek, and the window plays from the start.
	const VideoControlsModule = metro.findByFilePath(VIDEO_CONTROLS_PATH, { interop: false });
	const controls = () => videoControls(VideoControlsModule);
	let latest: { time: number; at: number } | undefined;
	const manager = NativeModules.MediaPlayerManager as object | undefined;
	const subscription = manager
		? new NativeEventEmitter(manager as never).addListener(
				PLAYER_PROGRESS_EVENT,
				({ time, duration }: Progress) => {
					if (typeof time === 'number' && typeof duration === 'number' && duration > 0) {
						latest = { time, at: Date.now() };
					}
				},
			)
		: undefined;

	return {
		position() {
			return latest && Date.now() - latest.at <= PROGRESS_FRESH_MS ? latest.time : undefined;
		},
		isPaused() {
			return controls()?.paused === true;
		},
		pause() {
			controls()?.controls?.pause?.(true);
		},
		resume(seconds, play) {
			const player = controls()?.controls;

			player?.seek?.(seconds);

			if (play) player?.pause?.(false);
		},
		dispose() {
			subscription?.remove();
		},
	};
}
