type TimerHandle = ReturnType<typeof setTimeout>;

type Schedule = <A extends unknown[]>(
	callback: (...args: A) => void,
	delay?: number,
	...args: A
) => TimerHandle;

type Clear = (handle: TimerHandle | undefined) => void;

/** Timer functions that track what they schedule, so `dispose` can clear whatever is still pending. */
export type ScopedTimers = {
	setTimeout: Schedule;
	setInterval: Schedule;
	clearTimeout: Clear;
	clearInterval: Clear;
	dispose: () => void;
};

/**
 * @description Creates timer functions for one addon that clear every pending timeout and interval on dispose.
 * A timer scheduled after dispose is cleared at once and never runs.
 * @returns The scoped timer functions and their `dispose`.
 */
export function createScopedTimers(): ScopedTimers {
	const pending = new Map<TimerHandle, Clear>();
	let disposed = false;

	function track(handle: TimerHandle, clear: Clear): TimerHandle {
		if (disposed) {
			clear(handle);
		} else {
			pending.set(handle, clear);
		}

		return handle;
	}

	function release(handle: TimerHandle | undefined, clear: Clear): void {
		if (handle !== undefined) {
			pending.delete(handle);
		}

		clear(handle);
	}

	return {
		setTimeout(callback, delay, ...args) {
			const handle = globalThis.setTimeout(
				(...params: typeof args) => {
					pending.delete(handle);
					callback(...params);
				},
				delay,
				...args,
			);

			return track(handle, globalThis.clearTimeout);
		},
		setInterval(callback, delay, ...args) {
			return track(
				globalThis.setInterval(callback, delay, ...args),
				globalThis.clearInterval,
			);
		},
		clearTimeout(handle) {
			release(handle, globalThis.clearTimeout);
		},
		clearInterval(handle) {
			release(handle, globalThis.clearInterval);
		},
		dispose() {
			disposed = true;

			for (const [handle, clear] of pending) clear(handle);

			pending.clear();
		},
	};
}

export default { createScopedTimers };
