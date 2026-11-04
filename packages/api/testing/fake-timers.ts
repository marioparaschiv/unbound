type TimerHandle = ReturnType<typeof setTimeout>;

type Schedule = <A extends unknown[]>(
	callback: (...args: A) => void,
	delay?: number,
	...args: A
) => TimerHandle;

type Clear = (handle: TimerHandle | undefined) => void;

/** The timer functions of the plugin scope: they run for real, and the scope clears what is still pending when the plugin stops. */
export type FakeTimers = {
	setTimeout: Schedule;
	setInterval: Schedule;
	clearTimeout: Clear;
	clearInterval: Clear;
	/** How many timeouts and intervals are scheduled and not yet run or cleared. */
	pending: () => number;
	/** Clears every pending timeout and interval, as the scope does on stop. */
	clearAll: () => void;
};

/**
 * @description Creates the scoped timers, over the timer functions that exist when it is called.
 * @returns The timers.
 */
export function createFakeTimers(): FakeTimers {
	const real = {
		setTimeout: globalThis.setTimeout.bind(globalThis),
		setInterval: globalThis.setInterval.bind(globalThis),
		clearTimeout: globalThis.clearTimeout.bind(globalThis),
		clearInterval: globalThis.clearInterval.bind(globalThis),
	};
	const pending = new Map<TimerHandle, Clear>();

	function track(handle: TimerHandle, clear: Clear): TimerHandle {
		pending.set(handle, clear);

		return handle;
	}

	function release(handle: TimerHandle | undefined, clear: Clear) {
		if (handle !== undefined) {
			pending.delete(handle);
		}

		clear(handle);
	}

	return {
		setTimeout(callback, delay, ...args) {
			const handle = real.setTimeout(
				(...params: typeof args) => {
					pending.delete(handle);
					callback(...params);
				},
				delay,
				...args,
			);

			return track(handle, real.clearTimeout);
		},
		setInterval: (callback, delay, ...args) =>
			track(real.setInterval(callback, delay, ...args), real.clearInterval),
		clearTimeout: (handle) => release(handle, real.clearTimeout),
		clearInterval: (handle) => release(handle, real.clearInterval),
		pending: () => pending.size,
		clearAll() {
			for (const [handle, clear] of pending) clear(handle);

			pending.clear();
		},
	};
}
