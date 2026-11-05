import noop from '@unbound-app/utils/noop';

import { setRejectionTracker } from './promise-rejections';

/**
 * Takes Hermes' rejection tracker back once Discord's main module has run. Discord replaces the one
 * installed before its bundle while it starts, and each call replaces the last.
 */
export function start() {
	setRejectionTracker();
}

/** Stops logging rejections; Hermes cannot remove a tracker, so a silent one replaces it. */
export function stop() {
	setRejectionTracker(noop);
}

export default { start, stop };
