import type { createLogger } from '@unbound-app/logger';

const SLOW_STOP_MS = 2000;

/**
 * @description Runs an addon's synchronous stop and warns when it held Discord's JavaScript thread for more than 2 s.
 * @template T The stop's result.
 * @param name The addon's name.
 * @param logger The addon manager's logger.
 * @param stop Runs the addon's stop.
 * @param now Reads the time, in milliseconds.
 * @returns What the stop returned.
 */
export function timedStop<T>(
	name: string,
	logger: Pick<ReturnType<typeof createLogger>, 'warn'>,
	stop: () => T,
	now: () => number = Date.now,
): T {
	const startedAt = now();
	const result = stop();
	const blockedMs = now() - startedAt;

	if (blockedMs > SLOW_STOP_MS) {
		logger.warn(
			`${name} blocked Discord for ${blockedMs} ms while it stopped; its stop() should hand slow work off.`,
		);
	}

	return result;
}
