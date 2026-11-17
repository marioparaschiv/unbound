import { createLogger } from '@unbound-app/logger';

const FAILURE_LIMIT = 3;
const SLOW_MS = 50;
const SLOW_LIMIT = 5;

const logger = createLogger('Flux', 'Guard');

/** A Flux action listener, or an interceptor that may drop the action by returning `true`. */
export type FluxHandler = (action: never) => boolean | void;

type HandlerCounts = { failures: number; slow: number };

function warnRemoved(owner: string, action: string) {
	import('~/toasts/api')
		.then(({ warning }) => warning('UNBOUND_HANDLER_REMOVED', { name: owner, action }))
		.catch((error) => logger.error(`Failed to show removal toast for ${owner}:`, error));
}

function settle(counts: HandlerCounts, startedAt: number): void {
	counts.failures = 0;
	counts.slow = performance.now() - startedAt > SLOW_MS ? counts.slow + 1 : 0;
}

/**
 * @description Wraps a plugin's Flux listener or interceptor so a throw is logged under the plugin's name and the action
 * goes on, and removes it after 3 throws in a row or 5 calls in a row slower than 50 ms.
 * @template F The handler's type.
 * @param handler The handler.
 * @param owner The plugin's name.
 * @param action The action type it handles.
 * @param remove Removes the handler.
 * @returns The guarded handler.
 */
export function guardedHandler<F extends FluxHandler>(
	handler: F,
	owner: string,
	action: string,
	remove: () => void,
): F {
	const counts: HandlerCounts = { failures: 0, slow: 0 };
	let removed = false;

	function drop() {
		if (removed) {
			return;
		}

		removed = true;
		remove();
		warnRemoved(owner, action);
	}

	return ((payload: Parameters<F>[0]) => {
		if (removed) {
			return undefined;
		}

		const startedAt = performance.now();

		try {
			const result = handler(payload);

			settle(counts, startedAt);

			if (counts.slow === SLOW_LIMIT) {
				logger.warn(
					`Removed ${owner}'s ${action} handler: ${SLOW_LIMIT} calls in a row over ${SLOW_MS} ms`,
				);
				drop();
			}

			return result;
		} catch (error) {
			counts.failures++;
			logger.error(`Failed to run ${owner}'s ${action} handler:`, error);

			if (counts.failures === FAILURE_LIMIT) {
				drop();
			}

			return undefined;
		}
	}) as F;
}
