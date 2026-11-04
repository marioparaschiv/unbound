import { metro } from '@unbound-app/api';
import { NativeEventEmitter, NativeModules } from 'react-native';

import { PLAYER_PROGRESS_EVENT, PROGRESS_FRESH_MS, VIDEO_CONTROLS_PATH } from '~/constants';

type Progress = { time?: unknown; duration?: unknown };

type VideoControls = {
	seek?: (seconds: number) => void;
	pause?: (paused: boolean) => void;
};

type VideoStateStore = {
	getState(): { controls?: VideoControls; paused?: boolean };
};

const VideoControlsModule = metro.findByFilePath(VIDEO_CONTROLS_PATH, {
	interop: false,
});

export type ViewerPlayback = {
	position(): number | undefined;
	isPaused(): boolean;
	pause(): void;
	resume(seconds: number, play: boolean): void;
	dispose(): void;
};

function videoControls(): ReturnType<VideoStateStore['getState']> | undefined {
	const store = (
		VideoControlsModule.module as { useVideoStateStore?: VideoStateStore } | undefined
	)?.useVideoStateStore;

	return typeof store?.getState === 'function' ? store.getState() : undefined;
}

/**
 * @description Follows the media viewer's native video player on Android: where it is, from the progress events Discord's `MediaPlayerManager` emits, and its pause and seek controls.
 * @returns The viewer's playback, with a `dispose` that stops listening.
 */
export function createViewerPlayback(): ViewerPlayback {
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
			return videoControls()?.paused === true;
		},
		pause() {
			videoControls()?.controls?.pause?.(true);
		},
		resume(seconds, play) {
			const controls = videoControls()?.controls;

			controls?.seek?.(seconds);

			if (play) controls?.pause?.(false);
		},
		dispose() {
			subscription?.remove();
		},
	};
}
