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
 * A timer scheduled after dispose is cleared at once and never runs. A callback that throws goes to `onError`, since
 * Discord drops timer errors without logging them.
 * @param onError Receives what a timer callback threw.
 * @returns The scoped timer functions and their `dispose`.
 */
export function createScopedTimers(onError: (error: unknown) => void): ScopedTimers {
	const pending = new Map<TimerHandle, Clear>();
	let disposed = false;

	function guard<A extends unknown[]>(callback: (...args: A) => void, ...params: A): void {
		try {
			callback(...params);
		} catch (error) {
			onError(error);
		}
	}

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
					guard(callback, ...params);
				},
				delay,
				...args,
			);

			return track(handle, globalThis.clearTimeout);
		},
		setInterval(callback, delay, ...args) {
			return track(
				globalThis.setInterval(
					(...params: typeof args) => guard(callback, ...params),
					delay,
					...args,
				),
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
