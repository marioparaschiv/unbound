import { createLogger } from '@unbound-app/logger';

const Logger = createLogger('Core', 'PromiseRejections');

/**
 * @description Logs one unhandled promise rejection.
 * @param id The rejection tracker's id for the promise.
 * @param error What the promise was rejected with.
 */
// UNKNOWN: a promise can be rejected with any value.
export function logRejection(id: number | undefined, error: unknown): void {
	Logger.error(`Unhandled promise rejection ${id ?? '?'}:`, error);
}

/**
 * @description Points Hermes' rejection tracker at Unbound's log. Runs before Discord's bundle, so it imports
 * nothing from Metro; Sentry replaces this tracker when Discord starts it.
 */
export function trackPromiseRejections(): void {
	const hermes = typeof HermesInternal === 'undefined' ? null : HermesInternal;

	if (hermes === null || !('enablePromiseRejectionTracker' in hermes)) return;

	(hermes as HermesInternalObject).enablePromiseRejectionTracker?.({
		allRejections: true,
		onUnhandled: logRejection,
	});
}
