import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import { afterFirstFrame } from '~/core/first-frame';

const Logger = createLogger('Core', 'PromiseRejections');

let active = false;

function setRejectionTracker(
	onUnhandled: NonNullable<PromiseRejectionTrackerOptions['onUnhandled']>,
) {
	const hermes = typeof HermesInternal === 'undefined' ? null : HermesInternal;

	if (hermes === null || !('enablePromiseRejectionTracker' in hermes)) return;

	(hermes as HermesInternalObject).enablePromiseRejectionTracker?.({
		allRejections: true,
		onUnhandled,
	});
}

// UNKNOWN: a promise can be rejected with any value.
function logRejection(id: number, error: unknown) {
	Logger.error(`Unhandled promise rejection ${id}:`, error);
}

/**
 * @description Points Hermes' rejection tracker at Unbound's log, replacing the tracker set before.
 */
export function trackRejections(): void {
	setRejectionTracker(logRejection);
}

/**
 * Logs unhandled promise rejections. Discord hands them only to the Sentry SDK, which Unbound blocks,
 * so they would otherwise vanish.
 */
export function start() {
	active = true;

	// Sentry enables the tracker while Discord starts, and each call replaces the last, so this one
	// waits until Discord has drawn.
	afterFirstFrame(() => {
		if (active) {
			trackRejections();
		}
	});
}

/** Stops logging rejections. Hermes cannot remove a tracker, and Sentry's is gone, so it goes quiet. */
export function stop() {
	active = false;
	setRejectionTracker(noop);
}

export default { start, stop };
