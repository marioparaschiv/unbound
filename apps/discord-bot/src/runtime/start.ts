import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { Unlisten } from '~/runtime/listen';
import { listen } from '~/runtime/listen';

type Task = () => Promise<void>;

// One chain per dispatcher, so a reconcile and a handle never race on the same Discord message.
function createSerialQueue() {
	let tail: Promise<void> = Promise.resolve();

	return function enqueue(task: Task): Promise<void> {
		const run = tail.then(task);

		tail = run.catch(() => void 0);

		return run;
	};
}

/**
 * @description Listens on each dispatcher's channel, running its reconcile and handle calls one at a time.
 * @param dispatchers The registered dispatchers.
 * @param context The database and the ready Discord client handed to each call.
 * @returns A function that stops every listener.
 */
export async function startDispatchers(
	dispatchers: Dispatcher[],
	context: DispatcherContext,
): Promise<Unlisten> {
	const unlisteners = await Promise.all(
		dispatchers.map((dispatcher) => {
			const enqueue = createSerialQueue();

			return listen(
				context.db.$client,
				dispatcher.channel,
				(payload) => enqueue(() => dispatcher.handle(payload, context)),
				() => enqueue(() => dispatcher.reconcile(context)),
			);
		}),
	);

	return async () => {
		await Promise.all(unlisteners.map((unlisten) => unlisten()));
	};
}

export default { startDispatchers };
