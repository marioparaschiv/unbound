import noop from '@unbound-app/utils/noop';

import { startAppSession, stopAppSession } from './app-session';
import { setRejectionTracker } from './promise-rejections';
import { recordError } from './recent-errors';

type ErrorHandler = ReturnType<typeof ErrorUtils.getGlobalHandler>;

let previousHandler: ErrorHandler | undefined;

/**
 * Takes Hermes' rejection tracker back once Discord's main module has run, and records uncaught errors for
 * `/debug` before React Native's handler sees them. Discord replaces the tracker installed before its bundle.
 */
export function start() {
	setRejectionTracker();
	startAppSession();

	if (typeof ErrorUtils === 'undefined') {
		return;
	}

	previousHandler = ErrorUtils.getGlobalHandler();

	const forward = previousHandler;

	ErrorUtils.setGlobalHandler((error, isFatal) => {
		recordError(error);
		forward(error, isFatal);
	});
}

/** Stops logging rejections; Hermes cannot remove a tracker, so a silent one replaces it. */
export function stop() {
	setRejectionTracker(noop);
	stopAppSession();

	if (!previousHandler) {
		return;
	}

	ErrorUtils.setGlobalHandler(previousHandler);
	previousHandler = undefined;
}

export default { start, stop };
