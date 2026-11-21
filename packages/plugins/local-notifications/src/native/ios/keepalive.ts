import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const MIX_WITH_OTHERS = 1;
const INTERRUPTION_ENDED = 1;
const SILENCE_SECONDS = 2;
const CHECK_MS = 60_000;
const NUDGE_MS = 5 * 60_000;
const NUDGE_ID = 'unbound-local-notifications-keepalive';

type ObjC = NativeBridge['objc'];

function silentWav(): Uint8Array {
	const rate = 8000;
	const samples = rate * SILENCE_SECONDS;
	const view = new DataView(new ArrayBuffer(44 + samples * 2));
	const text = (offset: number, value: string) =>
		[...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

	text(0, 'RIFF');
	view.setUint32(4, 36 + samples * 2, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, 'data');
	view.setUint32(40, samples * 2, true);

	return new Uint8Array(view.buffer);
}

function session(objc: ObjC): NativeObjectHandle {
	return objc.call(objc.getClass('AVAudioSession')!, 'sharedInstance') as NativeObjectHandle;
}

export type KeepAlive = { stop(): void };

/**
 * @description Keeps Discord running in the background, the way iRPC does: a silent looping sound in a mixing playback
 * session, which Discord's `audio` background mode allows; a restart when an interruption such as a call ends; a check
 * every minute that the sound still plays; and a local notification posted and removed every five minutes.
 * @param native The plugin's native bridge.
 * @returns The running keep-alive.
 */
export function startKeepAlive({ objc }: NativeBridge): KeepAlive {
	let player: NativeObjectHandle | null = null;
	let starting: Promise<void> | null = null;
	let stopped = false;

	const play = async () => {
		await objc.invokeAsync(session(objc), 'setCategory:withOptions:error:', [
			'AVAudioSessionCategoryPlayback',
			MIX_WITH_OTHERS,
			null,
		]);
		await objc.invokeAsync(session(objc), 'setActive:error:', [true, null]);
		if (stopped) return;

		player = objc.create('AVAudioPlayer', 'initWithData:error:', [
			objc.data(silentWav()),
			null,
		]) as NativeObjectHandle;
		objc.invoke(player, 'setNumberOfLoops:', [-1]);
		objc.invoke(player, 'setVolume:', [0]);
		await objc.invokeAsync(player, 'play', []);
	};

	const ensurePlaying = () => {
		if (starting || stopped) return;

		try {
			if (player && objc.invoke(player, 'isPlaying', [])) return;
		} catch (error) {
			logger.error('Failed to check the background keep-alive:', error);
		}

		starting = play()
			.catch((error: unknown) =>
				logger.error('Failed to restart the background keep-alive:', error),
			)
			.finally(() => {
				starting = null;
			});
	};

	const nudge = () => {
		try {
			const center = objc.call(
				objc.getClass('UNUserNotificationCenter')!,
				'currentNotificationCenter',
			) as NativeObjectHandle;
			const content = objc.create(
				'UNMutableNotificationContent',
				'init',
				[],
			) as NativeObjectHandle;
			const request = objc.call(
				objc.getClass('UNNotificationRequest')!,
				'requestWithIdentifier:content:trigger:',
				NUDGE_ID,
				content,
				null,
			);

			objc.invoke(center, 'addNotificationRequest:withCompletionHandler:', [request, null]);
			setTimeout(() => {
				objc.invoke(center, 'removeDeliveredNotificationsWithIdentifiers:', [[NUDGE_ID]]);
				objc.invoke(center, 'removePendingNotificationRequestsWithIdentifiers:', [
					[NUDGE_ID],
				]);
			}, 1000);
		} catch (error) {
			logger.error('Failed to post the keep-alive notification:', error);
		}
	};

	const center = objc.call(
		objc.getClass('NSNotificationCenter')!,
		'defaultCenter',
	) as NativeObjectHandle;
	const onInterruption = objc.block({ returnType: 'void', args: ['object'] }, ((
		notification: NativeObjectHandle,
	) => {
		const info = objc.invoke(notification, 'userInfo', []) as Record<string, unknown> | null;

		if (Number(info?.AVAudioSessionInterruptionTypeKey) === INTERRUPTION_ENDED)
			setTimeout(ensurePlaying, 500);
	}) as never);
	const observer = objc.invoke(center, 'addObserverForName:object:queue:usingBlock:', [
		'AVAudioSessionInterruptionNotification',
		null,
		objc.call(objc.getClass('NSOperationQueue')!, 'mainQueue'),
		onInterruption,
	]);

	ensurePlaying();

	const check = setInterval(ensurePlaying, CHECK_MS);
	const nudges = setInterval(nudge, NUDGE_MS);

	return {
		stop() {
			stopped = true;
			clearInterval(check);
			clearInterval(nudges);

			try {
				if (observer) objc.invoke(center, 'removeObserver:', [observer]);
				if (player) objc.invoke(player, 'stop', []);
				player = null;
			} catch (error) {
				logger.error('Failed to stop the background keep-alive:', error);
			}
		},
	};
}
