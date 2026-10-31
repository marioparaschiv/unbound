import { createLogger } from '@unbound-app/logger';

import { DISCORD_IDS, type DiscordIds, type IdConstantName } from '~/lib/constants';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import createSerialQueue from '~/runtime/serial-queue';
import type { Unlisten } from '~/runtime/listen';
import { listen } from '~/runtime/listen';

export type SkippedDispatcher = {
	dispatcher: Dispatcher;
	missing: IdConstantName[];
};

export type DispatcherSelection = {
	started: Dispatcher[];
	skipped: SkippedDispatcher[];
};

export type RunningDispatchers = {
	started: Dispatcher[];
	stop: Unlisten;
};

const logger = createLogger('Bot', 'Dispatchers');

/**
 * @description Splits the dispatchers into those whose required ids are all set and those still missing one.
 * @param dispatchers The registered dispatchers.
 * @param ids The id constants; an `undefined` id is unset.
 * @returns The dispatchers to start, and each skipped one with its unset constants.
 */
export function selectDispatchers(
	dispatchers: Dispatcher[],
	ids: DiscordIds = DISCORD_IDS,
): DispatcherSelection {
	const selection: DispatcherSelection = { started: [], skipped: [] };

	for (const dispatcher of dispatchers) {
		const missing = dispatcher.requires.filter((name) => ids[name] === undefined);

		if (missing.length) {
			selection.skipped.push({ dispatcher, missing });
		} else {
			selection.started.push(dispatcher);
		}
	}

	return selection;
}

/**
 * @description Starts each dispatcher whose ids are set: listens on its channel and reconciles it every `reconcileIntervalMs`, one call at a time.
 * @param dispatchers The registered dispatchers; one missing an id is skipped with a warning.
 * @param context The database and the ready Discord client handed to each call.
 * @param url The connection string each listener opens its own connection with.
 * @param reconcileIntervalMs How often each dispatcher's reconcile runs on a timer.
 * @param ids The id constants each dispatcher's `requires` is checked against.
 * @returns The started dispatchers, and `stop()` which stops every timer and listener and resolves once their in-flight calls have settled.
 */
export function startDispatchers(
	dispatchers: Dispatcher[],
	context: DispatcherContext,
	url: string,
	reconcileIntervalMs: number,
	ids: DiscordIds = DISCORD_IDS,
): RunningDispatchers {
	const { started, skipped } = selectDispatchers(dispatchers, ids);

	for (const { dispatcher, missing } of skipped) {
		logger.warn(
			`Not starting ${dispatcher.name}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still unset in src/lib/constants.ts.`,
		);
	}

	// One queue per dispatcher, so a reconcile and a handle never race on the same Discord message.
	const running = started.map((dispatcher) => {
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

	async function stop() {
		for (const { timer } of running) {
			clearInterval(timer);
		}

		await Promise.all(running.map(({ unlisten }) => unlisten()));
		await Promise.all(running.map(({ queue }) => queue.drain()));
	}

	return { started, stop };
}

export default { selectDispatchers, startDispatchers };
