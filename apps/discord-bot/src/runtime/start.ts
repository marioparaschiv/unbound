import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import createSerialQueue from '~/runtime/serial-queue';
import type { Unlisten } from '~/runtime/listen';
import { listen } from '~/runtime/listen';

/**
 * @description Listens on each dispatcher's channel, running its reconcile and handle calls one at a time.
 * @param dispatchers The registered dispatchers.
 * @param context The database and the ready Discord client handed to each call.
 * @param url The connection string each listener opens its own connection with.
 * @returns A function that stops every listener and resolves once their in-flight calls have settled.
 */
export function startDispatchers(
	dispatchers: Dispatcher[],
	context: DispatcherContext,
	url: string,
): Unlisten {
	// One queue per dispatcher, so a reconcile and a handle never race on the same Discord message.
	const running = dispatchers.map((dispatcher) => {
		const queue = createSerialQueue();
		const unlisten = listen({
			url,
			channel: dispatcher.channel,
			handler: (payload) => queue.enqueue(() => dispatcher.handle(payload, context)),
			reconcile: () => queue.enqueue(() => dispatcher.reconcile(context)),
		});

		return { queue, unlisten };
	});

	return async () => {
		await Promise.all(running.map(({ unlisten }) => unlisten()));
		await Promise.all(running.map(({ queue }) => queue.drain()));
	};
}

export default { startDispatchers };
