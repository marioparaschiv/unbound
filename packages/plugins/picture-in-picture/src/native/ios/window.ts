import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { NativeHandle, NativeObjCBridge } from '@unbound-app/api/native';

import { asHandle, findViewerPlayerLayer } from '~/native/ios/player-layer';
import { keepPlayingInBackground } from '~/native/ios/background-playback';
import { IOS_POLL_MS, IOS_WATCH_MS, START_TIMEOUT_MS } from '~/lib/constants';
import type { CreateWindow, PipWindow } from '~/lib/types';
import { patchWebViews } from '~/patches/web-views';
import { withWebPlayers } from '~/native/ios/web-window';

const STEP_TIMEOUT_MS = START_TIMEOUT_MS / 2;

type PipController = {
	layer: NativeHandle;
	controller: NativeHandle;
};

const unsupported: PipWindow = {
	enter: () => Promise.resolve('failed'),
	exit: () => 'ended',
	dispose: () => {},
};

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
	for (let waited = 0; waited < timeoutMs; waited += IOS_POLL_MS) {
		if (await check()) return true;

		await wait(IOS_POLL_MS);
	}

	return check();
}

function isTrue(objc: NativeObjCBridge, controller: NativeHandle, selector: string) {
	return async () => (await safeInvokeAsync(objc, controller, selector)) === true;
}

async function createPipController(
	objc: NativeObjCBridge,
	playerLayer: NativeHandle,
): Promise<NativeHandle | null> {
	const PipControllerClass = objc.getClass('AVPictureInPictureController');

	if (!PipControllerClass) return null;

	const supported = await safeInvokeAsync(
		objc,
		PipControllerClass,
		'isPictureInPictureSupported',
	);

	if (supported !== true) return null;

	try {
		return asHandle(
			objc.create(PipControllerClass, 'initWithPlayerLayer:', [playerLayer], {
				thread: 'main',
			}),
		);
	} catch {
		return null;
	}
}

/**
 * @description Opens iOS's picture in picture window for the video the media viewer shows, with an `AVPictureInPictureController` on the `AVPlayerLayer` of Discord's native player, keeps it playing while Discord is in the background, and reports when the window closes.
 * A controller is kept for its layer and reused, since AVKit is still tearing the previous one down for a while after its window closes.
 * @param context The plugin context, whose Objective-C bridge drives AVKit.
 * @param events Called when the window closes, from its own close button or from the plugin.
 * @returns The window, or one that never opens when the loader lacks a capability it needs.
 */
function createNativeWindow(
	context: Parameters<CreateWindow>[0],
	events: Parameters<CreateWindow>[1],
): PipWindow {
	if (!ensureCapabilities(context.native, context.capabilities)) return unsupported;

	const { objc } = context.native;
	let cached: PipController | null = null;
	let active: NativeHandle | null = null;
	let watcher: ReturnType<typeof setInterval> | undefined;
	let stopResuming: () => void = () => {};
	let disposed = false;

	function release() {
		if (watcher !== undefined) clearInterval(watcher);

		stopResuming();
		stopResuming = () => {};
		watcher = undefined;
		active = null;
	}

	function end() {
		if (!active) return;

		release();
		events.onEnded();
	}

	function watch(controller: NativeHandle) {
		const isActive = isTrue(objc, controller, 'isPictureInPictureActive');

		watcher = setInterval(() => {
			isActive()
				.then((stillActive) => {
					if (!stillActive && active === controller) end();
				})
				.catch(() => end());
		}, IOS_WATCH_MS);
	}

	function stop(controller: NativeHandle) {
		safeInvokeAsync(objc, controller, 'stopPictureInPicture').catch(() => null);
	}

	async function controllerFor(playerLayer: NativeHandle): Promise<NativeHandle | null> {
		const reusable =
			cached && (await safeInvokeAsync(objc, cached.layer, 'isEqual:', playerLayer)) === true;

		if (reusable && cached) return cached.controller;

		const controller = await createPipController(objc, playerLayer);

		cached = controller ? { layer: playerLayer, controller } : null;

		return controller;
	}

	return {
		async enter() {
			if (active) stop(active);

			release();

			const playerLayer = await findViewerPlayerLayer(objc);
			const controller = playerLayer ? await controllerFor(playerLayer) : null;

			if (disposed || !playerLayer || !controller) return 'failed';

			active = controller;

			const possible = await waitFor(
				isTrue(objc, controller, 'isPictureInPicturePossible'),
				STEP_TIMEOUT_MS,
			);

			if (!possible) {
				release();

				return 'failed';
			}

			await safeInvokeAsync(objc, controller, 'startPictureInPicture');

			const started = await waitFor(
				isTrue(objc, controller, 'isPictureInPictureActive'),
				STEP_TIMEOUT_MS,
			);

			if (disposed || active !== controller || !started) {
				if (active === controller) release();

				return 'failed';
			}

			watch(controller);

			const resuming = await keepPlayingInBackground(objc, playerLayer);

			if (active === controller) stopResuming = resuming;
			else resuming();

			return 'active';
		},
		exit() {
			if (!active) return 'ended';

			stop(active);

			return 'pending';
		},
		dispose() {
			disposed = true;

			if (active) stop(active);

			release();
			cached = null;
		},
	};
}

/**
 * @description Opens iOS's picture in picture window for what the media viewer shows: a native video through `AVPictureInPictureController`, or a web player such as YouTube through WebKit.
 * @param context The plugin context, whose Objective-C bridge drives AVKit.
 * @param events Called when the window closes.
 * @returns The window.
 */
export const createWindow: CreateWindow = (context, events) =>
	withWebPlayers(createNativeWindow(context, events), patchWebViews(), events);
