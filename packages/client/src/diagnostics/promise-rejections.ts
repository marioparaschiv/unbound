import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

import { recordError, stackAddon } from './recent-errors';
import { createFloodCounter } from './rejection-floods';

const Logger = createLogger('Core', 'PromiseRejections');
const countRejection = createFloodCounter();

let onFlood: ((addon: string) => void) | undefined;

/**
 * @description Sets what happens when one plugin floods Discord with unhandled rejections.
 * @param handler Receives the plugin's source name, once per plugin, or `undefined` to stop reacting.
 */
export function setRejectionFloodHandler(handler: ((addon: string) => void) | undefined): void {
	onFlood = handler;
}

// UNKNOWN: a promise can be rejected with any value.
function logRejection(id: number, error: unknown) {
	const addon = stackAddon(toError(error).stack ?? '');

	recordError(error);
	Logger.error(
		addon
			? `Unhandled promise rejection ${id} in ${addon}:`
			: `Unhandled promise rejection ${id}:`,
		error,
	);

	if (addon && countRejection(addon)) {
		onFlood?.(addon);
	}
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
