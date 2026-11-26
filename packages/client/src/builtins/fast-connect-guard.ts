import { createLogger } from '@unbound-app/logger';

import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byProps } from '~/metro/filters';

/** Discord's early gateway socket, opened at import time so the gateway answers sooner. */
type FastConnectSocket = { state?: { open?: boolean } };

declare global {
	var _ws: FastConnectSocket | null | undefined;
}

const Patcher = createPatcher('unbound::fast-connect-guard');
const Logger = createLogger('FastConnectGuard');

let stopWaiting: (() => void) | undefined;

function patchFastConnect(FastConnect: MetroExport) {
	if (
		typeof FastConnect?.identifyWebSocket !== 'function' ||
		typeof FastConnect?.closeFastConnectSocket !== 'function'
	) {
		Logger.warn('Fast connect guard skipped: Discord moved identifyWebSocket.');

		return;
	}

	Patcher.instead(FastConnect, 'identifyWebSocket', ({ args, original, this: self }) => {
		// Native code sends the queued IDENTIFY on open, so an already open socket never identifies and READY never comes.
		if (globalThis._ws?.state?.open) {
			Logger.info(
				'Closing the fast connect socket, which opened before Discord could identify on it.',
			);
			FastConnect.closeFastConnectSocket();

			return;
		}

		return original.apply(self, args);
	});
}

/**
 * @description Stops a slow launch from leaving Discord on "Connecting" for good: when the early gateway socket opens
 * before Discord queues its IDENTIFY, the socket is dropped so Discord connects the normal way.
 */
export function start() {
	stopWaiting = onModuleLoaded(
		byProps('identifyWebSocket', 'closeFastConnectSocket'),
		patchFastConnect,
	);
}

/**
 * @description Stops guarding the fast connect socket.
 */
export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
