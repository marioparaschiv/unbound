const FIRST_DELAY_MS = 250;
const LONGEST_DELAY_MS = 10_000;
const GIVE_UP_AFTER_MS = 10 * 60_000;

/** A pending retry, which `cancel` stops. */
export type HookRetry = { cancel(): void };

/**
 * @description Retries an attempt with backoff until it succeeds, it is cancelled or ten minutes pass, for hooks on
 * classes Discord has not loaded yet.
 * @param attempt Tries once; returns whether it succeeded.
 * @param schedule Runs a callback later, `setTimeout` by default.
 * @param cancelTimer Stops a scheduled callback, `clearTimeout` by default.
 * @returns The retry, so its owner can cancel it.
 */
export function retryUntilInstalled(
	attempt: () => boolean,
	schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout,
	cancelTimer: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
): HookRetry {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let cancelled = false;
	let waited = 0;

	function next(delay: number) {
		if (cancelled || waited >= GIVE_UP_AFTER_MS) return;

		timer = schedule(() => {
			waited += delay;

			if (cancelled || attempt()) return;

			next(Math.min(delay * 2, LONGEST_DELAY_MS));
		}, delay);
	}

	next(FIRST_DELAY_MS);

	return {
		cancel() {
			cancelled = true;

			if (timer !== undefined) {
				cancelTimer(timer);
			}
		},
	};
}

export default { retryUntilInstalled };
