import {
	javaFlag,
	javaInt,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { currentActivity } from '@unbound-plugins/shared/native/android/views';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativeJavaHookToken } from '@unbound-app/api/native';
import { AppState } from 'react-native';

import { createViewerPlayback } from '~/window/android/viewer-playback';
import { playerKind } from '~/source';
import { createPipClipStore } from '~/window/android/pip-clip';
import { patchPipSurface } from '~/window/android/pip-surface';
import { ANDROID_SETTLE_MS, PLUGIN_NAME } from '~/constants';
import type { CreateWindow, MediaSource, PipWindow } from '~/types';

const MODE_CHANGED_PARAMETERS = ['boolean', 'android.content.res.Configuration'];

const unsupported: PipWindow = {
	enter: () => Promise.resolve('failed'),
	exit: () => 'ended',
	dispose: () => {},
};

function report(error: unknown) {
	if (!isCancellation(error)) console.error(`[${PLUGIN_NAME}] Android window failed:`, error);
}

function videoUri(source: MediaSource | undefined): string | undefined {
	const uri = source?.videoURI ?? source?.uri;

	return typeof uri === 'string' && uri ? uri : undefined;
}

function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ANDROID_SETTLE_MS));
}

/**
 * @description Puts Discord's activity into Android's picture in picture mode, shaped like the video, and reports when it leaves it.
 * The window shows Discord's own picture in picture surface, so the video plays there from where the viewer was, while the viewer's player waits paused; on leaving, the viewer picks up where the window stopped.
 * @param context The plugin context, whose Java bridge drives the activity.
 * @param events Called when the activity leaves picture in picture.
 * @returns The window, or one that never opens when the loader lacks a capability it needs.
 */
export const createWindow: CreateWindow = (context, events) => {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return unsupported;

	const { java, hooks } = context.native;
	const viewer = createViewerPlayback();
	const clips = createPipClipStore();
	const unpatchSurface = patchPipSurface(clips);
	let resumeAfter = false;
	let entered = false;
	let modeHook: NativeJavaHookToken | null = null;
	let disposed = false;

	function handBack() {
		const time = clips.hide();

		if (time !== undefined) viewer.resume(time, resumeAfter);
	}

	function leave() {
		if (!entered) return;

		entered = false;
		handBack();
		events.onEnded();
	}

	async function inPictureInPicture(): Promise<boolean> {
		const activity = currentActivity(java);

		return activity
			? javaFlag(await java.invokeAsync(activity, 'isInPictureInPictureMode', []))
			: false;
	}

	function watchMode() {
		if (disposed || modeHook) return;

		try {
			modeHook = hooks.hook(
				'android.app.Activity',
				'onPictureInPictureModeChanged',
				MODE_CHANGED_PARAMETERS,
				{ notify: 'after', payload: { receiver: false, arguments: [0] } },
				({ args }) => {
					if (!javaFlag(args[0])) leave();
				},
			);
		} catch (error) {
			report(error);
		}
	}

	const appState = AppState.addEventListener('change', (state) => {
		if (state !== 'active' || !entered) return;

		inPictureInPicture()
			.then((active) => {
				if (!active) leave();
			})
			.catch(report);
	});

	return {
		async enter([width, height], source) {
			const activity = currentActivity(java);
			const kind = playerKind(source);
			const uri = videoUri(source);

			if (disposed || !activity || !kind || (kind === 'video' && !uri)) return 'failed';

			watchMode();
			await settle();

			if (disposed) return 'failed';

			try {
				const builder = java.construct('android.app.PictureInPictureParams$Builder', []);
				const ratio = java.construct('android.util.Rational', [
					javaInt(width),
					javaInt(height),
				]);

				java.invoke(builder, 'setAspectRatio', [ratio]);

				const params = javaReference(java.invoke(builder, 'build', []));

				if (!params) return 'failed';

				if (kind === 'video' && uri) {
					resumeAfter = !viewer.isPaused();
					clips.show({ kind, uri, startAt: viewer.position() ?? 0 });
					viewer.pause();
				} else {
					clips.show({ kind: 'web' });
				}

				entered = javaFlag(
					await java.invokeAsync(activity, 'enterPictureInPictureMode', [params]),
				);
			} catch (error) {
				report(error);
				entered = false;
			}

			if (!entered) handBack();

			return entered ? 'active' : 'failed';
		},
		exit() {
			entered = false;
			handBack();

			return 'ended';
		},
		dispose() {
			disposed = true;
			appState.remove();
			handBack();
			unpatchSurface();
			viewer.dispose();

			if (modeHook) hooks.remove(modeHook);

			modeHook = null;
			entered = false;
		},
	};
};
