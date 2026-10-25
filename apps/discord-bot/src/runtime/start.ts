import { createLogger } from '@unbound-app/logger';

import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import createSerialQueue from '~/runtime/serial-queue';
import type { Unlisten } from '~/runtime/listen';
import { listen } from '~/runtime/listen';

const logger = createLogger('Bot', 'Dispatchers');

/**
 * @description Listens on each dispatcher's channel and reconciles it every `reconcileIntervalMs`, running its calls one at a time.
 * @param dispatchers The registered dispatchers.
 * @param context The database and the ready Discord client handed to each call.
 * @param url The connection string each listener opens its own connection with.
 * @param reconcileIntervalMs How often each dispatcher's reconcile runs on a timer.
 * @returns A function that stops every timer and listener and resolves once their in-flight calls have settled.
 */
export function startDispatchers(
	dispatchers: Dispatcher[],
	context: DispatcherContext,
	url: string,
	reconcileIntervalMs: number,
): Unlisten {
	// One queue per dispatcher, so a reconcile and a handle never race on the same Discord message.
	const running = dispatchers.map((dispatcher) => {
		const queue = createSerialQueue();
		const reconcile = () => queue.enqueue(() => dispatcher.reconcile(context));
		const unlisten = listen({
			url,
			channel: dispatcher.channel,
			handler: (payload) => queue.enqueue(() => dispatcher.handle(payload, context)),
			reconcile,
		});

		let pending = false;

		// A tick that finds the previous timer run still queued or running is skipped, so runs never stack.
		const timer = setInterval(() => {
			if (pending) return;

			pending = true;
			reconcile()
				.catch((error) =>
					logger.error(`Failed the timed reconcile of ${dispatcher.name}:`, error),
				)
				.finally(() => {
					pending = false;
				});
		}, reconcileIntervalMs);

		return { queue, unlisten, timer };
	});

	return async () => {
		for (const { timer } of running) {
			clearInterval(timer);
		}

		await Promise.all(running.map(({ unlisten }) => unlisten()));
		await Promise.all(running.map(({ queue }) => queue.drain()));
	};
}

export default { startDispatchers };
