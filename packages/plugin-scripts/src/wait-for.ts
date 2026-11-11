type WaitOptions = {
	/** How long to keep checking, in milliseconds. */
	timeoutMs: number;
	/** How long to wait between checks, in milliseconds. */
	intervalMs: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
};

/**
 * @description Checks a condition until it holds or the time runs out, for waits on something the device reports instead of a fixed sleep.
 * @param check Reads the condition.
 * @param options The time limit and the gap between checks.
 * @returns `true` once the condition held, or `false` when the time ran out first.
 */
export async function waitFor(
	check: () => Promise<boolean>,
	{ timeoutMs, intervalMs, sleep = Bun.sleep, now = Date.now }: WaitOptions,
): Promise<boolean> {
	const deadline = now() + timeoutMs;

	for (;;) {
		if (await check()) return true;

		if (now() >= deadline) return false;

		await sleep(intervalMs);
	}
}

export default { waitFor };
