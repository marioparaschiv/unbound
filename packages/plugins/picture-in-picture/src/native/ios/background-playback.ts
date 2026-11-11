import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';
import type { NativeHandle, NativeObjCBridge } from '@unbound-app/api/native';

import { asHandle } from '~/native/ios/player-layer';
import { IOS_WATCH_MS } from '~/lib/constants';

const KVO_SUBCLASS_PREFIX = 'NSKVONotifying_';
const APPLICATION_ACTIVE = 0;
const CONTINUES_IF_POSSIBLE = 3;
const POLICY_SELECTOR = 'audiovisualBackgroundPlaybackPolicy';
const SET_POLICY_SELECTOR = 'setAudiovisualBackgroundPlaybackPolicy:';

type HookHandler = (context: { args: unknown[] }) => void;

function hookableClassName(objc: NativeObjCBridge, player: NativeHandle): string | undefined {
	const name = objc.className(player);

	return typeof name === 'string' && name ? name.replace(KVO_SUBCLASS_PREFIX, '') : undefined;
}

async function isAppActive(objc: NativeObjCBridge): Promise<boolean> {
	const UIApplication = objc.getClass('UIApplication');
	const app = UIApplication
		? asHandle(await safeInvokeAsync(objc, UIApplication, 'sharedApplication'))
		: null;
	const state = app ? await safeInvokeAsync(objc, app, 'applicationState') : null;

	return Number(state) === APPLICATION_ACTIVE;
}

async function playerRate(objc: NativeObjCBridge, player: NativeHandle): Promise<number> {
	return Number(await safeInvokeAsync(objc, player, 'rate')) || 0;
}

async function allowBackgroundPlayback(
	objc: NativeObjCBridge,
	player: NativeHandle,
): Promise<() => void> {
	const previous = await safeInvokeAsync(objc, player, POLICY_SELECTOR);

	if (typeof previous !== 'number') return () => {};

	await safeInvokeAsync(objc, player, SET_POLICY_SELECTOR, CONTINUES_IF_POSSIBLE);

	return () => {
		safeInvokeAsync(objc, player, SET_POLICY_SELECTOR, previous).catch(() => null);
	};
}

async function activateAudioSession(objc: NativeObjCBridge): Promise<void> {
	const AVAudioSession = objc.getClass('AVAudioSession');
	const session = AVAudioSession
		? asHandle(await safeInvokeAsync(objc, AVAudioSession, 'sharedInstance'))
		: null;

	if (session) await safeInvokeAsync(objc, session, 'setActive:error:', true, null);
}

function hookAfter(
	objc: NativeObjCBridge,
	className: string,
	selector: string,
	player: NativeHandle,
	handler: HookHandler,
	argumentIndexes: number[] = [],
): () => void {
	try {
		const token = objc.hook(
			className,
			selector,
			{ after: handler },
			{ instance: player, payload: { arguments: argumentIndexes } },
		);

		return () => token.remove();
	} catch (error) {
		logger.error(`Could not watch ${selector} on the video player:`, error);

		return () => {};
	}
}

function trackPlayIntent(
	objc: NativeObjCBridge,
	player: NativeHandle,
	className: string,
	initiallyPlaying: boolean,
) {
	let wantsPlayback = initiallyPlaying;

	const stopWatchingRate = hookAfter(
		objc,
		className,
		'setRate:',
		player,
		({ args }) => {
			wantsPlayback = Number(args[0]) > 0;
		},
		[0],
	);
	const stopWatchingPause = hookAfter(objc, className, 'pause', player, () => {
		isAppActive(objc)
			.then((active) => {
				if (!active) wantsPlayback = true;
			})
			.catch(() => undefined);
	});

	return {
		wantsPlayback: () => wantsPlayback,
		stop() {
			stopWatchingRate();
			stopWatchingPause();
		},
	};
}

/**
 * @description Keeps the video in the picture in picture window playing while Discord is in the background. Discord's native player only plays in the foreground: its background playback policy pauses video, and when the app leaves the foreground it sends itself `pause`, ignores `play` (also the `play` that restarts a looping video) and deactivates the audio session, which pauses the player again. The policy is relaxed for the session, and whenever Discord is not active while the video should play but is stopped, the audio session is reactivated and the rate set to 1, as the window's play button does. What the video should do follows the window's own controls, which use `setRate:`; a `pause` Discord sends while in the background is not the user's.
 * @param objc The Objective-C bridge from `context.native`.
 * @param playerLayer The `AVPlayerLayer` the window shows.
 * @returns A function that restores the player's policy and stops resuming it.
 */
export async function keepPlayingInBackground(
	objc: NativeObjCBridge,
	playerLayer: NativeHandle,
): Promise<() => void> {
	const player = asHandle(await safeInvokeAsync(objc, playerLayer, 'player'));
	const className = player ? hookableClassName(objc, player) : undefined;

	if (!player || !className) return () => {};

	const restorePolicy = await allowBackgroundPlayback(objc, player);
	const intent = trackPlayIntent(objc, player, className, (await playerRate(objc, player)) > 0);
	let resuming = false;

	async function resumeIfStopped(target: NativeHandle) {
		if (!intent.wantsPlayback() || (await isAppActive(objc))) return;
		if ((await playerRate(objc, target)) > 0) return;

		await activateAudioSession(objc);
		await safeInvokeAsync(objc, target, 'setRate:', 1);
	}

	const timer = setInterval(() => {
		if (resuming) return;

		resuming = true;
		resumeIfStopped(player)
			.catch(() => undefined)
			.finally(() => {
				resuming = false;
			});
	}, IOS_WATCH_MS);

	return () => {
		clearInterval(timer);
		intent.stop();
		restorePolicy();
	};
}
