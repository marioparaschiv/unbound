import { createLogger } from '@unbound-app/logger';

const Logger = createLogger('Core', 'PromiseRejections');

// UNKNOWN: a promise can be rejected with any value.
function logRejection(id: number, error: unknown) {
	Logger.error(`Unhandled promise rejection ${id}:`, error);
}

/**
 * @description Points Hermes' rejection tracker at `onUnhandled`, replacing the tracker set before. Runs before
 * Discord's bundle too, so it imports nothing from Metro.
 * @param onUnhandled Receives each unhandled rejection; logs it by default.
 */
export function setRejectionTracker(
	onUnhandled: NonNullable<PromiseRejectionTrackerOptions['onUnhandled']> = logRejection,
): void {
	const hermes = typeof HermesInternal === 'undefined' ? null : HermesInternal;

	if (hermes === null || !('enablePromiseRejectionTracker' in hermes)) return;

	(hermes as HermesInternalObject).enablePromiseRejectionTracker?.({
		allRejections: true,
		onUnhandled,
	});
}
