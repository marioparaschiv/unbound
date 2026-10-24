type Timer = ReturnType<typeof setTimeout>;

export type Timers = ReturnType<typeof createTimers>;

/**
 * @description Tracks timeouts so stopping the plugin can cancel every one still pending.
 * @returns `later` schedules a callback, `cancel` drops one, `clear` drops them all.
 */
export function createTimers() {
	const pending = new Set<Timer>();

	function later(callback: () => void, delay: number = 0): Timer {
		const timer = setTimeout(() => {
			pending.delete(timer);
			callback();
		}, delay);

		pending.add(timer);

		return timer;
	}

	function cancel(timer: Timer | undefined) {
		if (!timer) return;

		clearTimeout(timer);
		pending.delete(timer);
	}

	function clear() {
		for (const timer of pending) clearTimeout(timer);

		pending.clear();
	}

	return { later, cancel, clear };
}
